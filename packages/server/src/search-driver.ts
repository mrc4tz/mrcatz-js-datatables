import type {
  FilterContext,
  FilterDefinition,
  FilterType,
  NormalizedSearch,
  ResolvedValue,
  TableQuery,
  UtcOffset,
} from '@mrc4tz/datatable-core';
import type { Where } from './prisma-where';

/**
 * Kontrak mesin pencari eksternal (pengganti `search.driver = 'scout'` versi
 * Laravel). Driver mengembalikan id baris yang sudah terurut relevansi; engine
 * lalu memakai pipeline yang sama dengan mode relevansi:
 *   id terurut → `where: { id: { in } }` di Prisma (+ filter sisa) → urutkan
 *   ulang sesuai peringkat (atau sesuai sort pengguna bila ada) → paginate.
 */

/** Filter aktif (nilai sudah dinormalisasi) yang diteruskan ke driver. */
export interface ActiveFilter {
  def: FilterDefinition<Where>;
  value: ResolvedValue<FilterType>;
}

export interface SearchDriverRequest<TCtx = unknown> {
  /** Kata kunci pencarian (tidak pernah kosong). */
  search: string;
  query: TableQuery;
  /** Filter yang sedang aktif — driver boleh menerapkan sebagian (pushdown). */
  filters: ActiveFilter[];
  filterContext: FilterContext;
  /** Konteks request dari `query(raw, { context })`. */
  context: TCtx;
  /** Field primary key di Prisma. */
  primaryKey: string;
  utcOffset?: UtcOffset;
}

export interface SearchDriverResult {
  /** Id baris, urut dari yang paling relevan. */
  ids: unknown[];
  /** Id filter yang sudah diterapkan driver — engine tidak menerapkannya lagi di SQL. */
  pushedFilters?: string[];
}

/** Ringkasan definisi tabel yang diberikan ke `SearchDriver.validate`. */
export interface SearchDriverTableInfo {
  search: NormalizedSearch;
  filters: FilterDefinition<Where>[];
  sortable: string[] | null;
  primaryKey: string;
}

export interface SearchDriver<TCtx = any> {
  /** Nama driver (untuk pesan error/log). */
  readonly name: string;
  /**
   * Cari id yang cocok. Kembalikan `null` untuk memakai pencarian Prisma biasa
   * (mis. driver sedang tidak tersedia).
   */
  search(req: SearchDriverRequest<TCtx>): Promise<SearchDriverResult | null>;
  /** Validasi konfigurasi saat `defineDataTable` — lempar `DataTableConfigError` bila tidak valid. */
  validate?(table: SearchDriverTableInfo): void;
}
