/**
 * Tipe protokol bersama antara server (engine) dan client (komponen Vue).
 *
 * Alur: client menyimpan `TableQuery` (state tabel) → diserialisasi ke query
 * string (`toSearchParams`) → server mem-parse (`parseTableQuery`) → engine
 * mengembalikan `TablePage<T>`.
 */

export type SortDirection = 'asc' | 'desc';

export interface SortRule {
  key: string;
  dir: SortDirection;
}

/** Nilai filter rentang tanggal; salah satu sisi boleh kosong (rentang terbuka). */
export interface RangeValue {
  from?: string | null;
  to?: string | null;
}

/** Nilai filter multi-pilihan beserta mode include/exclude. */
export interface MultiValue {
  values: string[];
  exclude?: boolean;
}

export type FilterValue = string | RangeValue | MultiValue;

/** State query tabel — satu sumber kebenaran untuk URL, API, dan engine. */
export interface TableQuery {
  page: number;
  limit: number;
  search: string;
  sort: SortRule[];
  filters: Record<string, FilterValue>;
}

/** Meta pagination — sengaja identik dengan `PaginationMeta` di halotabalong. */
export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Mode load-more: masih ada baris setelah `limit` saat ini. */
  hasMore?: boolean;
}

export interface TablePage<T> {
  data: T[];
  meta: PageMeta;
}

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

export type FilterType = 'select' | 'multi' | 'date' | 'dateRange';

/**
 * Granularitas nilai filter tanggal.
 *
 * `time` (`HH:mm:ss`) dan `timeHm` (`HH:mm`) adalah jam dalam sehari (pengganti
 * `time` / `time_hm` versi Laravel). Prisma tidak bisa mengekstrak jam secara
 * portabel, jadi di engine server keduanya wajib memakai `where`.
 */
export type DateFormat = 'date' | 'datetime' | 'month' | 'year' | 'time' | 'timeHm';

export type CompareOperator = '=' | '!=' | '>' | '>=' | '<' | '<=';

export interface FilterOption {
  value: string | number | boolean;
  label: string;
}

/** Konteks yang diterima loader opsi & predikat visibilitas (filter bertingkat). */
export interface FilterContext {
  /** Nilai filter aktif saat ini, dikunci berdasarkan id filter. */
  values: Record<string, FilterValue | undefined>;
}

/** Nilai statis atau fungsi dari konteks filter (dihitung ulang saat filter lain berubah). */
export type Dynamic<T> = T | ((ctx: FilterContext) => T);

export type OptionsSource =
  | FilterOption[]
  | ((ctx: FilterContext) => FilterOption[] | Promise<FilterOption[]>);

/**
 * Bentuk filter yang sudah diserialisasi (tanpa fungsi) — dikirim server ke
 * client lewat endpoint schema, atau dipakai langsung oleh client.
 */
export interface FilterSchema {
  id: string;
  label: string;
  type: FilterType;
  options?: FilterOption[];
  format?: DateFormat;
  min?: string;
  max?: string;
  /** Hanya untuk `multi`: tampilkan toggle Termasuk/Kecuali. */
  allowExclude?: boolean;
  /** Hanya untuk `multi`: tampilkan kotak cari bila jumlah opsi melebihi angka ini. */
  searchThreshold?: number | null;
  /** Id filter lain yang memengaruhi opsi/visibilitas filter ini. */
  dependsOn?: string[];
  visible: boolean;
}

export interface TableSchema {
  filters: FilterSchema[];
}
