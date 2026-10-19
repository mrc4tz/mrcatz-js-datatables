import {
  compareBounds,
  dateOperator,
  isTimeFormat,
  periodOf,
  rangeBounds,
  InvalidDateValueError,
  type DateBounds,
  type FilterContext,
  type FilterDefinition,
  type NormalizedSearch,
  type ResolvedValue,
  type UtcOffset,
} from '@mrcatz/datatable-core';
import { DataTableConfigError, DataTableQueryError } from './errors';
import type { Where } from './prisma-where';
import type { ActiveFilter, SearchDriver, SearchDriverResult, SearchDriverTableInfo } from './search-driver';

/**
 * Driver Meilisearch (pengganti `search.driver = 'scout'` + `mrcatz:meilisearch:configure`
 * versi Laravel).
 *
 * Paket `meilisearch` sengaja TIDAK menjadi dependensi: client diketik secara
 * struktural, cukup teruskan `new MeiliSearch({ host, apiKey })` milik aplikasi.
 *
 * @example
 * import { MeiliSearch } from 'meilisearch';
 * import { meilisearchDriver } from '@mrcatz/datatable-server/meilisearch';
 *
 * defineDataTable({
 *   model: prisma.product,
 *   search: {
 *     columns: [{ field: 'name', weight: 5 }, 'sku'],
 *     driver: meilisearchDriver({
 *       client: new MeiliSearch({ host, apiKey }),
 *       index: 'products',
 *       dateFields: { createdAt: 'createdAtTs' }, // atribut berisi unix detik
 *     }),
 *   },
 * });
 */

// ---------------------------------------------------------------------------
// Tipe client minimal (struktural)
// ---------------------------------------------------------------------------

export interface MeilisearchSearchParams {
  filter?: string;
  limit?: number;
  offset?: number;
  attributesToRetrieve?: string[];
  [key: string]: unknown;
}

export interface MeilisearchSettings {
  searchableAttributes?: string[];
  filterableAttributes?: string[];
  sortableAttributes?: string[];
  typoTolerance?: {
    enabled?: boolean;
    minWordSizeForTypos?: { oneTypo?: number; twoTypos?: number };
  };
}

export interface MeilisearchIndexLike {
  search(
    query: string,
    options?: MeilisearchSearchParams,
  ): Promise<{ hits: Array<Record<string, any>> }>;
  /** Dibutuhkan `syncMeilisearchSettings`. */
  updateSettings?(settings: MeilisearchSettings): Promise<unknown>;
}

export interface MeilisearchClientLike {
  index(uid: string): MeilisearchIndexLike;
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

/**
 * `auto`   — filter yang bisa diterjemahkan dikirim ke Meilisearch, sisanya tetap di SQL (default).
 * `always` — semua filter wajib bisa diterjemahkan; bila tidak → `DataTableConfigError` saat definisi.
 * `never`  — semua filter tetap di SQL; Meilisearch hanya dipakai untuk pencarian.
 */
export type FilterPushdownMode = 'auto' | 'always' | 'never';

export interface MeilisearchDriverOptions {
  client: MeilisearchClientLike;
  /** Nama (uid) index. */
  index: string;
  /** Batas id yang diambil dari Meilisearch (pengganti `scout_max_results`). Default 1000. */
  maxResults?: number;
  /** Default `auto`. */
  filterPushdown?: FilterPushdownMode;
  /**
   * Filter tanggal → atribut Meilisearch berisi unix timestamp (detik), pengganti
   * `date_field_map`. Kunci boleh id filter atau `field`-nya.
   */
  dateFields?: Record<string, string>;
  /** Atribut id di dokumen Meilisearch. Default primary key tabel. */
  primaryKey?: string;
  /** Ubah id dari Meilisearch sebelum dipakai di Prisma (mis. `Number`). */
  castId?: (id: unknown) => unknown;
  /** Parameter pencarian tambahan, mis. `{ matchingStrategy: 'all' }`. */
  searchParams?: Record<string, unknown>;
  /** Dipanggil (mode `auto`) saat filter tidak bisa dikirim dan tetap diterapkan di SQL. */
  onFallback?: (filterId: string, reason: string) => void;
}

export interface MeilisearchDriver extends SearchDriver {
  readonly name: 'meilisearch';
  readonly options: Readonly<MeilisearchDriverOptions>;
}

const ATTR = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const MODES: FilterPushdownMode[] = ['auto', 'always', 'never'];

function assertAttr(name: string, what: string): void {
  if (!ATTR.test(name)) throw new DataTableConfigError(`${what} "${name}" bukan nama atribut Meilisearch yang valid.`);
}

/** Nilai literal filter Meilisearch: angka & boolean apa adanya, string di-quote. */
export function meiliValue(v: unknown): string {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `"${String(v).replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

function dateAttr(def: FilterDefinition, dateFields: Record<string, string>): string | undefined {
  return dateFields[def.id] ?? (def.field ? dateFields[def.field] : undefined);
}

/**
 * Alasan filter tidak bisa diterjemahkan ke Meilisearch, atau `null` bila bisa.
 * Murni dari definisi — sehingga mode `always` bisa diperiksa saat `defineDataTable`.
 */
export function pushdownBlocker(def: FilterDefinition, dateFields: Record<string, string> = {}): string | null {
  if (def.where) return 'memakai `where` kustom (tidak bisa diterjemahkan)';
  if (!def.field) return 'tidak punya `field`';
  switch (def.type) {
    case 'select':
      if (def.operator === 'contains') return "operator 'contains' tidak didukung filter Meilisearch";
      return ATTR.test(def.field) ? null : `field "${def.field}" bukan atribut Meilisearch yang valid`;
    case 'multi':
      return ATTR.test(def.field) ? null : `field "${def.field}" bukan atribut Meilisearch yang valid`;
    case 'date':
    case 'dateRange':
      if (isTimeFormat(def.format)) return 'format jam (time/timeHm) tidak bisa diterjemahkan';
      return dateAttr(def, dateFields) ? null : 'tidak ada entri `dateFields` untuk filter tanggal ini';
  }
}

const sec = (d: Date) => Math.floor(d.getTime() / 1000);

function boundsExpr(attr: string, b: DateBounds): string {
  if ('not' in b) return `(${attr} < ${sec(b.not.start)} OR ${attr} >= ${sec(b.not.end)})`;
  const parts: string[] = [];
  if (b.gte) parts.push(`${attr} >= ${sec(b.gte)}`);
  if (b.lt) parts.push(`${attr} < ${sec(b.lt)}`);
  return `(${parts.join(' AND ')})`;
}

/** Terjemahkan satu filter aktif ke ekspresi filter Meilisearch (anggap sudah lolos `pushdownBlocker`). */
export function translateFilter(
  af: ActiveFilter,
  ctx: FilterContext,
  dateFields: Record<string, string> = {},
  utcOffset?: UtcOffset,
): string {
  const { def, value } = af;
  const field = def.field!;
  try {
    switch (def.type) {
      case 'select': {
        return `${field} ${def.operator ?? '='} ${meiliValue(value)}`;
      }
      case 'multi': {
        const { values, exclude } = value as ResolvedValue<'multi'>;
        return `${field} ${exclude ? 'NOT IN' : 'IN'} [${values.map(meiliValue).join(', ')}]`;
      }
      case 'date': {
        const bounds = compareBounds(
          periodOf(value as string, def.format ?? 'date', utcOffset),
          dateOperator(def as FilterDefinition, ctx),
        );
        return boundsExpr(dateAttr(def, dateFields)!, bounds);
      }
      case 'dateRange': {
        const { from, to } = value as ResolvedValue<'dateRange'>;
        return boundsExpr(dateAttr(def, dateFields)!, rangeBounds(from, to, def.format ?? 'date', utcOffset));
      }
    }
  } catch (e) {
    if (e instanceof InvalidDateValueError) throw new DataTableQueryError(e.message);
    throw e;
  }
}

export function meilisearchDriver(options: MeilisearchDriverOptions): MeilisearchDriver {
  const mode = options.filterPushdown ?? 'auto';
  if (!MODES.includes(mode)) {
    throw new DataTableConfigError(`filterPushdown tidak valid: "${String(mode)}" (pilih auto, always, atau never).`);
  }
  if (!options.index) throw new DataTableConfigError('meilisearchDriver butuh `index`.');
  const maxResults = Math.trunc(options.maxResults ?? 1000);
  if (!(maxResults >= 1)) throw new DataTableConfigError('maxResults harus ≥ 1.');
  const dateFields = options.dateFields ?? {};
  for (const attr of Object.values(dateFields)) assertAttr(attr, 'dateFields');
  if (options.primaryKey) assertAttr(options.primaryKey, 'primaryKey');

  return {
    name: 'meilisearch',
    options,

    validate(table: SearchDriverTableInfo) {
      if (mode !== 'always') return;
      for (const def of table.filters) {
        const reason = pushdownBlocker(def as FilterDefinition, dateFields);
        if (reason) {
          throw new DataTableConfigError(
            `filterPushdown 'always': filter "${def.id}" ${reason}. Pakai mode 'auto' atau 'never'.`,
          );
        }
      }
    },

    async search(req): Promise<SearchDriverResult> {
      const exprs: string[] = [];
      const pushed: string[] = [];

      if (mode !== 'never') {
        for (const af of req.filters) {
          const reason = pushdownBlocker(af.def as FilterDefinition, dateFields);
          if (reason) {
            if (mode === 'always') throw new DataTableConfigError(`Filter "${af.def.id}" ${reason}.`);
            options.onFallback?.(af.def.id, reason);
            continue;
          }
          exprs.push(translateFilter(af, req.filterContext, dateFields, req.utcOffset));
          pushed.push(af.def.id);
        }
      }

      const idAttr = options.primaryKey ?? req.primaryKey;
      const params: MeilisearchSearchParams = {
        ...options.searchParams,
        limit: maxResults,
        attributesToRetrieve: [idAttr],
      };
      if (exprs.length) params.filter = exprs.join(' AND ');

      const res = await options.client.index(options.index).search(req.search, params);
      const cast = options.castId ?? ((id: unknown) => id);
      return {
        ids: res.hits.map((h) => cast(h[idAttr])).filter((id) => id !== undefined && id !== null),
        pushedFilters: pushed,
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Sinkronisasi pengaturan index (pengganti `mrcatz:meilisearch:configure`)
// ---------------------------------------------------------------------------

/** Bagian tabel yang dibaca helper settings — `defineDataTable(...)` memenuhinya lewat `config`. */
export interface MeilisearchTableLike {
  config: {
    search: NormalizedSearch;
    filters: FilterDefinition<Where>[];
    sortable: string[] | null;
    driver?: SearchDriver;
  };
}

function isMeiliDriver(d: SearchDriver | undefined): d is MeilisearchDriver {
  return !!d && d.name === 'meilisearch' && 'options' in d;
}

const unique = (xs: string[]) => [...new Set(xs)];

/**
 * Hitung pengaturan index dari definisi tabel:
 * - `searchableAttributes` dari `search.columns`, urut bobot terbesar,
 * - `filterableAttributes` dari `field` filter yang bisa dikirim + `dateFields`,
 * - `sortableAttributes` dari `sortable`,
 * - `typoTolerance` dari `search.typoTolerance` (hanya bila diaktifkan).
 */
export function meilisearchSettings(
  table: MeilisearchTableLike,
  opts: { dateFields?: Record<string, string> } = {},
): MeilisearchSettings {
  const { search, filters, sortable, driver } = table.config;
  const dateFields = opts.dateFields ?? (isMeiliDriver(driver) ? driver.options.dateFields : undefined) ?? {};
  const settings: MeilisearchSettings = {};

  const searchable = search.columns
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.weight - a.c.weight || a.i - b.i)
    .map(({ c }) => c.field);
  if (searchable.length) settings.searchableAttributes = unique(searchable);

  const filterable: string[] = [];
  for (const def of filters) {
    if (pushdownBlocker(def as FilterDefinition, dateFields)) continue;
    filterable.push(def.type === 'date' || def.type === 'dateRange' ? dateAttr(def as FilterDefinition, dateFields)! : def.field!);
  }
  filterable.push(...Object.values(dateFields));
  if (filterable.length) settings.filterableAttributes = unique(filterable);

  if (sortable?.length) settings.sortableAttributes = unique(sortable);

  if (search.typo.driver !== 'none') {
    const min = search.typo.minWordLength;
    settings.typoTolerance = { enabled: true, minWordSizeForTypos: { oneTypo: min, twoTypos: min * 2 } };
  }
  return settings;
}

/**
 * Kirim pengaturan index ke Meilisearch. `client` & `index` default diambil dari
 * `meilisearchDriver` milik tabel. Kembalikan pengaturan yang dikirim.
 *
 * @example
 * await syncMeilisearchSettings(productTable, meili, 'products');
 * // lalu indeks ulang dokumen dari aplikasi
 */
export async function syncMeilisearchSettings(
  table: MeilisearchTableLike,
  client?: MeilisearchClientLike,
  index?: string,
  opts: { dryRun?: boolean; dateFields?: Record<string, string> } = {},
): Promise<MeilisearchSettings> {
  const driver = table.config.driver;
  const c = client ?? (isMeiliDriver(driver) ? driver.options.client : undefined);
  const uid = index ?? (isMeiliDriver(driver) ? driver.options.index : undefined);
  if (!c || !uid) {
    throw new DataTableConfigError('syncMeilisearchSettings butuh `client` dan `index` (atau tabel dengan meilisearchDriver).');
  }
  const settings = meilisearchSettings(table, opts);
  if (opts.dryRun) return settings;

  const idx = c.index(uid);
  if (typeof idx.updateSettings !== 'function') {
    throw new DataTableConfigError('Client Meilisearch tidak punya `index(uid).updateSettings()`.');
  }
  await idx.updateSettings(settings);
  return settings;
}
