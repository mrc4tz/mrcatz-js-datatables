import { isEmptyFilterValue } from './filters';
import type { FilterType, FilterValue, SortRule, TableQuery } from './types';

/**
 * Serialisasi `TableQuery` ⇄ query string. Skema kunci (semua opsional):
 *
 *   search=budi
 *   page=2&limit=20
 *   sort=nama:asc,createdAt:desc        (multi-sort, urutan = prioritas)
 *   f.status=aktif                      (select / date)
 *   f.kategori=1&f.kategori=3           (multi)  +  f.kategori.not=1 (mode Kecuali)
 *   f.dibuat.from=2026-01-01&f.dibuat.to=2026-01-31   (dateRange)
 *
 * `prefix` memberi namespace bila beberapa tabel berada di satu halaman
 * (setara `urlPrefix()` di versi Laravel), mis. `pengguna_` → `pengguna_search`.
 */

export type RawQuery =
  | URLSearchParams
  | Record<string, string | string[] | number | undefined | null>;

export interface ParseOptions {
  prefix?: string;
  defaultLimit?: number;
  /** Batas atas `limit` agar client tidak bisa meminta jutaan baris. Default 100. */
  maxLimit?: number;
  defaultSort?: SortRule[];
  /** Tipe tiap filter — membuat parsing presisi (mis. multi dengan satu nilai). */
  filterTypes?: Record<string, FilterType>;
}

const FILTER_PREFIX = 'f.';

function entries(raw: RawQuery): Array<[string, string]> {
  if (raw instanceof URLSearchParams) return [...raw.entries()];
  const out: Array<[string, string]> = [];
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((x) => out.push([k, String(x)]));
    else out.push([k, String(v)]);
  }
  return out;
}

export function parseSort(raw: string | undefined | null): SortRule[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [key, dir] = part.split(':');
      return { key: key!, dir: dir === 'desc' ? 'desc' : 'asc' } as SortRule;
    })
    .filter((s) => s.key.length > 0);
}

export function formatSort(sort: SortRule[]): string {
  return sort.map((s) => `${s.key}:${s.dir}`).join(',');
}

function toPositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function parseTableQuery(raw: RawQuery, opts: ParseOptions = {}): TableQuery {
  const prefix = opts.prefix ?? '';
  const maxLimit = opts.maxLimit ?? 100;
  const single = new Map<string, string>();
  const multi = new Map<string, string[]>();

  for (const [fullKey, value] of entries(raw)) {
    if (!fullKey.startsWith(prefix)) continue;
    const key = fullKey.slice(prefix.length);
    single.set(key, value);
    multi.set(key, [...(multi.get(key) ?? []), value]);
  }

  const filters: Record<string, FilterValue> = {};
  for (const [key, values] of multi) {
    if (!key.startsWith(FILTER_PREFIX)) continue;
    const rest = key.slice(FILTER_PREFIX.length);
    const m = /^(.+)\.(from|to|not)$/.exec(rest);
    const id = m ? m[1]! : rest;
    const part = m?.[2];
    const type = opts.filterTypes?.[id];

    if (part === 'from' || part === 'to') {
      const cur = (filters[id] as { from?: string; to?: string } | undefined) ?? {};
      filters[id] = { ...cur, [part]: values[0] };
    } else if (part === 'not') {
      const cur = filters[id];
      const list = cur && typeof cur === 'object' && 'values' in cur ? cur.values : [];
      filters[id] = { values: list, exclude: values[0] === '1' || values[0] === 'true' };
    } else if (type === 'multi' || (type === undefined && values.length > 1)) {
      const cur = filters[id];
      const exclude = cur && typeof cur === 'object' && 'values' in cur ? cur.exclude : false;
      filters[id] = { values: values.filter((v) => v !== ''), exclude };
    } else {
      filters[id] = values[0]!;
    }
  }

  const sort = parseSort(single.get('sort'));
  return {
    search: (single.get('search') ?? '').trim(),
    page: toPositiveInt(single.get('page'), 1),
    limit: Math.min(toPositiveInt(single.get('limit'), opts.defaultLimit ?? 10), maxLimit),
    sort: sort.length ? sort : (opts.defaultSort ?? []),
    filters,
  };
}

export interface SerializeOptions {
  prefix?: string;
  /** Nilai yang sama dengan default tidak ditulis ke URL agar URL tetap ringkas. */
  defaults?: Partial<Pick<TableQuery, 'page' | 'limit'>>;
}

export function toSearchParams(
  query: Partial<TableQuery>,
  opts: SerializeOptions = {},
): URLSearchParams {
  const p = opts.prefix ?? '';
  const params = new URLSearchParams();
  const d = { page: 1, ...opts.defaults };

  if (query.search) params.set(`${p}search`, query.search);
  if (query.page && query.page !== d.page) params.set(`${p}page`, String(query.page));
  if (query.limit && query.limit !== d.limit) params.set(`${p}limit`, String(query.limit));
  if (query.sort?.length) params.set(`${p}sort`, formatSort(query.sort));

  for (const [id, value] of Object.entries(query.filters ?? {})) {
    if (isEmptyFilterValue(value)) continue;
    const k = `${p}${FILTER_PREFIX}${id}`;
    if (typeof value === 'string') params.set(k, value);
    else if ('values' in value) {
      value.values.forEach((v) => params.append(k, String(v)));
      if (value.exclude) params.set(`${k}.not`, '1');
    } else {
      if (value.from) params.set(`${k}.from`, value.from);
      if (value.to) params.set(`${k}.to`, value.to);
    }
  }
  return params;
}

/** Kunci query milik tabel ini — dipakai untuk membersihkan URL tanpa menyentuh param lain. */
export function isTableParam(key: string, prefix = ''): boolean {
  if (!key.startsWith(prefix)) return false;
  const k = key.slice(prefix.length);
  return ['search', 'page', 'limit', 'sort'].includes(k) || k.startsWith(FILTER_PREFIX);
}
