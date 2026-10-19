import { toValue, type MaybeRefOrGetter } from 'vue';
import {
  createMemoryTable,
  toSearchParams,
  type FilterDefinition,
  type FilterSchema,
  type MemoryTableOptions,
  type TablePage,
  type TableQuery,
  type TableSchema,
} from '@mrcatz/datatable-core';

/**
 * Sumber data tabel. Komponen tidak peduli datanya dari API atau array lokal —
 * cukup objek yang memenuhi kontrak ini.
 */
export interface DataSource<T> {
  /** Kunci cache TanStack Query; ubah bila sumber berubah (mis. per instansi). */
  key: string;
  fetch(query: TableQuery, signal?: AbortSignal): Promise<TablePage<T>>;
  /** Schema filter (opsi dinamis + visibilitas bertingkat). */
  schema?(query: TableQuery, signal?: AbortSignal): Promise<TableSchema>;
  /** Semua baris sesuai query, untuk export. Fallback: memanggil `fetch` per halaman. */
  fetchAll?(query: TableQuery, signal?: AbortSignal): Promise<T[]>;
}

export type Fetcher = (
  url: string,
  init: { query: Record<string, string | string[]>; signal?: AbortSignal },
) => Promise<unknown>;

export interface HttpSourceOptions<T> {
  /** Endpoint daftar, mis. `/master/pengguna`. */
  url: string;
  /** Endpoint schema filter, mis. `/master/pengguna/schema`. */
  schemaUrl?: string;
  /** Endpoint export (semua baris). Default `fetch` diulang per halaman. */
  exportUrl?: string;
  /**
   * Pemanggil HTTP. Di Nuxt oper `useApi()` / `$fetch` agar token & refresh
   * ikut. Default: `fetch` bawaan browser + `JSON`.
   */
  fetcher?: Fetcher;
  /** Prefix param (harus sama dengan `prefix` di `defineDataTable`). */
  prefix?: string;
  /** Ubah bentuk respons bila tidak berbentuk `{ data, meta }`. */
  transform?: (response: unknown) => TablePage<T>;
  key?: string;
}

function toQueryObject(params: URLSearchParams): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of params) {
    const cur = out[k];
    out[k] = cur === undefined ? v : Array.isArray(cur) ? [...cur, v] : [cur, v];
  }
  return out;
}

const defaultFetcher: Fetcher = async (url, { query, signal }) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) (Array.isArray(v) ? v : [v]).forEach((x) => qs.append(k, x));
  const res = await fetch(qs.size ? `${url}?${qs}` : url, { signal, headers: { accept: 'application/json' } });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status, data: await res.json().catch(() => null) });
  return res.json();
};

/** Terima `{data, meta}` atau envelope `{success, data: {data, meta}}` / `{success, data, meta}`. */
export function unwrapPage<T>(res: unknown): TablePage<T> {
  const r = res as Record<string, any>;
  if (Array.isArray(r?.data) && r.meta) return { data: r.data, meta: r.meta };
  if (r?.data && Array.isArray(r.data.data) && r.data.meta) return r.data;
  throw new Error('Respons tabel harus berbentuk { data: [], meta: { total, page, limit, totalPages } }');
}

function unwrapData<T>(res: unknown): T {
  const r = res as Record<string, any>;
  return (r && typeof r === 'object' && 'success' in r && 'data' in r ? r.data : r) as T;
}

export function httpSource<T>(opts: HttpSourceOptions<T>): DataSource<T> {
  const fetcher = opts.fetcher ?? defaultFetcher;
  const serialize = (q: TableQuery) => toQueryObject(toSearchParams(q, { prefix: opts.prefix }));
  const transform = opts.transform ?? unwrapPage<T>;

  const source: DataSource<T> = {
    key: opts.key ?? opts.url,
    async fetch(query, signal) {
      return transform(await fetcher(opts.url, { query: serialize(query), signal }));
    },
  };

  if (opts.schemaUrl) {
    const url = opts.schemaUrl;
    source.schema = async (query, signal) =>
      unwrapData<TableSchema>(await fetcher(url, { query: serialize({ ...query, page: 1 }), signal }));
  }
  if (opts.exportUrl) {
    const url = opts.exportUrl;
    source.fetchAll = async (query, signal) => {
      const res = unwrapData<T[] | { data: T[] }>(await fetcher(url, { query: serialize(query), signal }));
      return Array.isArray(res) ? res : res.data;
    };
  }
  return source;
}

/**
 * Sumber data in-memory — semantik filter/pencarian sama dengan engine server.
 * `rows` boleh ref/computed sehingga tabel ikut berubah saat data berubah
 * (panggil `refresh()` pada tabel atau ubah `key`).
 */
export function memorySource<T>(
  rows: MaybeRefOrGetter<T[]>,
  opts: MemoryTableOptions<T> & { key?: string } = {},
): DataSource<T> {
  const table = createMemoryTable<T>(() => toValue(rows), opts);
  return {
    key: opts.key ?? 'memory',
    async fetch(query) {
      return table.query(query);
    },
    async schema(query) {
      return table.describe({ values: query.filters });
    },
    async fetchAll(query) {
      return table.all(query);
    },
  };
}

/** Bentuk schema filter dari definisi (untuk sumber HTTP yang tidak punya endpoint schema). */
export function staticFilters(defs: FilterDefinition[]): FilterSchema[] {
  return defs.map((d) => ({
    id: d.id,
    label: d.label,
    type: d.type,
    visible: d.visible !== false,
    options: 'options' in d && Array.isArray(d.options) ? d.options : undefined,
    format: 'format' in d ? d.format : undefined,
    allowExclude: d.type === 'multi' ? d.allowExclude : undefined,
    searchThreshold: d.type === 'multi' ? (d.searchThreshold ?? null) : undefined,
  }));
}
