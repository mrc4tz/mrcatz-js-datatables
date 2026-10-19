import {
  compareBounds,
  inBounds,
  isTimeFormat,
  parseTimeOfDay,
  periodOf,
  rangeBounds,
  timeOfDay,
  type UtcOffset,
} from './dates';
import {
  dateOperator,
  describeFilters,
  resolveFilterValue,
  type FilterDefinition,
  type ResolvedValue,
} from './filters';
import { getPath, normalizeSearch, type NormalizedSearch, type SearchConfig } from './search-config';
import { splitKeywords, trigrams } from './search';
import type {
  CompareOperator,
  DateFormat,
  FilterContext,
  SortRule,
  TablePage,
  TableQuery,
  TableSchema,
} from './types';

export interface MemoryTableOptions<TRow> {
  search?: SearchConfig;
  filters?: FilterDefinition<unknown, TRow>[];
  /** Urutan bawaan bila pengguna belum mengurutkan kolom. */
  defaultSort?: SortRule[];
  utcOffset?: UtcOffset;
}

function toDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function compare(a: unknown, op: CompareOperator | 'contains', b: unknown): boolean {
  if (op === 'contains') return String(a ?? '').toLowerCase().includes(String(b).toLowerCase());
  // Perbandingan longgar: '1' cocok dengan 1 (nilai URL selalu string).
  const x = typeof b === 'number' ? Number(a) : a;
  switch (op) {
    case '=':
      return x == b;
    case '!=':
      return x != b;
    case '>':
      return (x as number) > (b as number);
    case '>=':
      return (x as number) >= (b as number);
    case '<':
      return (x as number) < (b as number);
    case '<=':
      return (x as number) <= (b as number);
  }
}

function sortValue(v: unknown): number | string {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  return String(v ?? '').toLowerCase();
}

export function scoreRow(row: unknown, words: string[], search: NormalizedSearch): number {
  const fuzzy = search.typo.driver !== 'none';
  let score = 0;
  for (const word of words) {
    const lower = word.toLowerCase();
    for (const col of search.columns) {
      const value = String(getPath(row, col.field) ?? '').toLowerCase();
      if (!value) continue;
      // Satu kecocokan persis selalu mengalahkan berapa pun bonus trigram.
      if (value.includes(lower)) score += col.weight * (fuzzy ? 100 : 1);
      if (fuzzy && word.length >= search.typo.minWordLength) {
        for (const g of trigrams(word)) if (value.includes(g)) score += 1;
      }
    }
  }
  return score;
}

function matchesWord(row: unknown, word: string, search: NormalizedSearch): boolean {
  const lower = word.toLowerCase();
  const fuzzy = search.typo.driver !== 'none' && word.length >= search.typo.minWordLength;
  return search.columns.some((col) => {
    const raw = getPath(row, col.field);
    if (col.type === 'number') return /^-?\d+(\.\d+)?$/.test(word) && Number(raw) === Number(word);
    const value = String(raw ?? '').toLowerCase();
    if (col.mode === 'equals') return value === lower;
    if (col.mode === 'startsWith') return value.startsWith(lower);
    if (value.includes(lower)) return true;
    return fuzzy && trigrams(word).some((g) => value.includes(g));
  });
}

/**
 * Engine in-memory: semantik filter/pencarian/sort sama dengan engine server.
 * Cocok untuk data kecil yang sudah ada di client, demo, dan unit test.
 */
export function createMemoryTable<TRow>(rows: TRow[] | (() => TRow[]), opts: MemoryTableOptions<TRow> = {}) {
  const search = normalizeSearch(opts.search);
  const defs = opts.filters ?? [];
  const getRows = typeof rows === 'function' ? rows : () => rows;

  /** Nilai sel sebagai Date; untuk format jam diubah ke jam-dalam-sehari (1970-01-01 UTC). */
  function cellDate(cell: unknown, format: DateFormat | undefined): Date | null {
    if (!isTimeFormat(format)) return toDate(cell);
    // Kolom jam murni ('14:30' / '14:30:15') dibaca apa adanya, tanpa zona waktu.
    if (typeof cell === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(cell.trim())) {
      return new Date(parseTimeOfDay(cell) * 1000);
    }
    const d = toDate(cell);
    return d ? timeOfDay(d, opts.utcOffset) : null;
  }

  function applyFilter(
    row: TRow,
    def: FilterDefinition<unknown, TRow>,
    value: ResolvedValue<any>,
    ctx: FilterContext,
  ): boolean {
    if (def.match) return (def.match as (r: TRow, v: unknown) => boolean)(row, value);
    if (!def.field) return true;
    const cell = getPath(row, def.field);

    switch (def.type) {
      case 'select':
        return compare(cell, def.operator ?? '=', value);
      case 'multi': {
        const { values, exclude } = value as ResolvedValue<'multi'>;
        const hit = values.some((v) => v == (cell as never));
        return exclude ? !hit : hit;
      }
      case 'date': {
        const d = cellDate(cell, def.format);
        if (!d) return false;
        const bounds = compareBounds(
          periodOf(value as string, def.format ?? 'date', opts.utcOffset),
          dateOperator(def as FilterDefinition, ctx),
        );
        return inBounds(d, bounds);
      }
      case 'dateRange': {
        const d = cellDate(cell, def.format);
        if (!d) return false;
        const { from, to } = value as ResolvedValue<'dateRange'>;
        return inBounds(d, rangeBounds(from, to, def.format ?? 'date', opts.utcOffset));
      }
    }
  }

  function filtered(query: Pick<TableQuery, 'search' | 'filters'>): Array<{ row: TRow; score: number }> {
    const words = splitKeywords(query.search);
    const active = defs
      .map((def) => ({ def, value: resolveFilterValue(def, query.filters[def.id]) }))
      .filter((x) => x.value !== undefined);

    const ctx: FilterContext = { values: query.filters };
    const out: Array<{ row: TRow; score: number }> = [];
    for (const row of getRows()) {
      if (!active.every(({ def, value }) => applyFilter(row, def, value!, ctx))) continue;
      if (words.length && search.columns.length) {
        const hit =
          search.match === 'all'
            ? words.every((w) => matchesWord(row, w, search))
            : words.some((w) => matchesWord(row, w, search));
        if (!hit) continue;
      }
      out.push({ row, score: words.length ? scoreRow(row, words, search) : 0 });
    }
    return out;
  }

  function sorted(items: Array<{ row: TRow; score: number }>, query: TableQuery) {
    const rules = query.sort.length ? query.sort : (opts.defaultSort ?? []);
    // Seperti versi Laravel: tanpa sort eksplisit, skor relevansi didahulukan,
    // urutan bawaan hanya menjadi penentu bila skornya sama.
    const byRelevance = query.sort.length === 0 && query.search !== '';
    return items.slice().sort((a, b) => {
      if (byRelevance && a.score !== b.score) return b.score - a.score;
      for (const r of rules) {
        const x = sortValue(getPath(a.row, r.key));
        const y = sortValue(getPath(b.row, r.key));
        if (x < y) return r.dir === 'asc' ? -1 : 1;
        if (x > y) return r.dir === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  return {
    query(query: TableQuery): TablePage<TRow> {
      const all = sorted(filtered(query), query);
      const total = all.length;
      const start = (query.page - 1) * query.limit;
      return {
        data: all.slice(start, start + query.limit).map((x) => x.row),
        meta: {
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.max(1, Math.ceil(total / query.limit)),
          hasMore: start + query.limit < total,
        },
      };
    },
    /** Semua baris hasil filter (tanpa pagination) — untuk export. */
    all(query: TableQuery): TRow[] {
      return sorted(filtered(query), query).map((x) => x.row);
    },
    count(query: Pick<TableQuery, 'search' | 'filters'>): number {
      return filtered(query).length;
    },
    async describe(ctx: FilterContext = { values: {} }): Promise<TableSchema> {
      return { filters: await describeFilters(defs as FilterDefinition[], ctx) };
    },
  };
}

export type MemoryTable<TRow> = ReturnType<typeof createMemoryTable<TRow>>;
