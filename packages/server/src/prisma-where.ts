import {
  compareBounds,
  periodOf,
  rangeBounds,
  splitKeywords,
  trigrams,
  InvalidDateValueError,
  type FilterDefinition,
  type FilterContext,
  type NormalizedSearch,
  type ResolvedValue,
  type SortRule,
  type UtcOffset,
} from '@mrcatz/datatable-core';
import { DataTableQueryError } from './errors';

/** Potongan `where` Prisma. Sengaja longgar agar bekerja dengan model apa pun. */
export type Where = Record<string, unknown>;

/** `nest('kategori.nama', {equals: 1})` → `{ kategori: { nama: { equals: 1 } } }` */
export function nest(path: string, condition: unknown): Where {
  return path
    .split('.')
    .reverse()
    .reduce<unknown>((acc, key) => ({ [key]: acc }), condition) as Where;
}

export function and(parts: Array<Where | undefined | null>): Where | undefined {
  const list = parts.filter((p): p is Where => !!p && Object.keys(p).length > 0);
  if (list.length === 0) return undefined;
  return list.length === 1 ? list[0] : { AND: list };
}

export interface WhereOptions {
  /** `mode: 'insensitive'` (PostgreSQL/MongoDB). Matikan untuk MySQL/SQLite. Default true. */
  insensitive: boolean;
  utcOffset?: UtcOffset;
}

function text(op: 'contains' | 'startsWith' | 'equals', value: string, o: WhereOptions) {
  return o.insensitive ? { [op]: value, mode: 'insensitive' } : { [op]: value };
}

function withDateGuard<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    if (e instanceof InvalidDateValueError) throw new DataTableQueryError(e.message);
    throw e;
  }
}

export function filterWhere(
  def: FilterDefinition<Where>,
  value: ResolvedValue<any>,
  ctx: FilterContext,
  o: WhereOptions,
): Where | undefined {
  if (def.where) return (def.where as (v: unknown, c: FilterContext) => Where | undefined)(value, ctx);
  if (!def.field) return undefined;
  const field = def.field;

  switch (def.type) {
    case 'select': {
      const op = def.operator ?? '=';
      const cond =
        op === 'contains'
          ? text('contains', String(value), o)
          : op === '='
            ? { equals: value }
            : op === '!='
              ? { not: value }
              : { [{ '>': 'gt', '>=': 'gte', '<': 'lt', '<=': 'lte' }[op]]: value };
      return nest(field, cond);
    }
    case 'multi': {
      const { values, exclude } = value as ResolvedValue<'multi'>;
      return nest(field, exclude ? { notIn: values } : { in: values });
    }
    case 'date':
      return withDateGuard(() => {
        const bounds = compareBounds(
          periodOf(value as string, def.format ?? 'date', o.utcOffset),
          def.operator ?? '=',
        );
        return 'not' in bounds
          ? { NOT: nest(field, { gte: bounds.not.start, lt: bounds.not.end }) }
          : nest(field, bounds);
      });
    case 'dateRange':
      return withDateGuard(() => {
        const { from, to } = value as ResolvedValue<'dateRange'>;
        return nest(field, rangeBounds(from, to, def.format ?? 'date', o.utcOffset));
      });
  }
}

/** Kondisi pencarian berbasis Prisma (tanpa SQL mentah). */
export function searchWhere(search: string, cfg: NormalizedSearch, o: WhereOptions): Where | undefined {
  const words = splitKeywords(search);
  if (!words.length || !cfg.columns.length) return undefined;

  const perWord = words
    .map((word): Where | undefined => {
      const fuzzy = cfg.typo.driver === 'trigram' && word.length >= cfg.typo.minWordLength;
      const or: Where[] = [];
      for (const col of cfg.columns) {
        if (col.type === 'number') {
          if (/^-?\d+(\.\d+)?$/.test(word)) or.push(nest(col.field, { equals: Number(word) }));
          continue;
        }
        or.push(nest(col.field, text(col.mode, word, o)));
        if (fuzzy) for (const g of trigrams(word)) or.push(nest(col.field, text('contains', g, o)));
      }
      return or.length ? { OR: or } : undefined;
    })
    .filter((w): w is Where => !!w);

  // Kata kunci tak bisa dicocokkan ke kolom mana pun → `OR: []` di Prisma berarti "tidak ada baris".
  if (!perWord.length) return { OR: [] };
  if (perWord.length === 1) return perWord[0];
  return cfg.match === 'all' ? { AND: perWord } : { OR: perWord };
}

const SORT_KEY = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;

export function orderBy(sort: SortRule[], sortable: ReadonlySet<string> | null): Where[] {
  return sort.map((s) => {
    if (!SORT_KEY.test(s.key) || (sortable && !sortable.has(s.key))) {
      throw new DataTableQueryError(`Kolom "${s.key}" tidak bisa diurutkan.`);
    }
    return nest(s.key, s.dir);
  });
}
