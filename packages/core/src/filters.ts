import type {
  CompareOperator,
  DateFormat,
  FilterContext,
  FilterOption,
  FilterSchema,
  FilterType,
  FilterValue,
  MultiValue,
  OptionsSource,
  RangeValue,
} from './types';

export type ValueCast = 'string' | 'number' | 'boolean';

/** Nilai filter setelah dinormalisasi & di-cast, sesuai tipe filternya. */
export type ResolvedValue<T extends FilterType> = T extends 'multi'
  ? { values: Array<string | number | boolean>; exclude: boolean }
  : T extends 'dateRange'
    ? { from: string | null; to: string | null }
    : T extends 'select'
      ? string | number | boolean
      : string;

interface CommonOptions<T extends FilterType, TWhere, TRow> {
  /**
   * Kolom yang difilter. Dot-path untuk relasi (`kategori.nama`).
   * Boleh dikosongkan bila memakai `where` / `match`.
   */
  field?: string;
  /**
   * Kondisi kustom untuk engine server (pengganti `createWithCallback`).
   * Kembalikan potongan `where` Prisma, atau `undefined` untuk tidak memfilter.
   */
  where?: (value: ResolvedValue<T>, ctx: FilterContext) => TWhere | undefined;
  /** Predikat kustom untuk sumber data in-memory. */
  match?: (row: TRow, value: ResolvedValue<T>) => boolean;
  /** Tampil/sembunyi; fungsi untuk filter bertingkat. Default `true`. */
  visible?: boolean | ((ctx: FilterContext) => boolean);
  /** Id filter induk — opsi/visibilitas dihitung ulang saat induknya berubah. */
  dependsOn?: string | string[];
}

export interface SelectFilterOptions<TWhere, TRow> extends CommonOptions<'select', TWhere, TRow> {
  options: OptionsSource;
  operator?: CompareOperator | 'contains';
  /** Tipe nilai di database. Default: ditebak dari tipe `value` opsi statis. */
  cast?: ValueCast;
}

export interface MultiFilterOptions<TWhere, TRow> extends CommonOptions<'multi', TWhere, TRow> {
  options: OptionsSource;
  /** Tampilkan toggle Termasuk/Kecuali (NOT IN). */
  allowExclude?: boolean;
  /** Tampilkan kotak cari opsi bila jumlah opsi > angka ini. `null` = tidak pernah. Default 5. */
  searchThreshold?: number | null;
  cast?: ValueCast;
}

export interface DateFilterOptions<TWhere, TRow> extends CommonOptions<'date', TWhere, TRow> {
  format?: DateFormat;
  operator?: CompareOperator;
  min?: string;
  max?: string;
}

export interface DateRangeFilterOptions<TWhere, TRow>
  extends CommonOptions<'dateRange', TWhere, TRow> {
  format?: DateFormat;
  min?: string;
  max?: string;
}

export type FilterDefinition<TWhere = unknown, TRow = any> =
  | ({ id: string; label: string; type: 'select' } & SelectFilterOptions<TWhere, TRow>)
  | ({ id: string; label: string; type: 'multi' } & MultiFilterOptions<TWhere, TRow>)
  | ({ id: string; label: string; type: 'date' } & DateFilterOptions<TWhere, TRow>)
  | ({ id: string; label: string; type: 'dateRange' } & DateRangeFilterOptions<TWhere, TRow>);

export class FilterDefinitionError extends Error {
  override name = 'FilterDefinitionError';
}

function assertTarget(id: string, opts: { field?: string; where?: unknown; match?: unknown }) {
  if (!opts.field && !opts.where && !opts.match) {
    throw new FilterDefinitionError(
      `Filter "${id}" butuh salah satu dari: field, where, atau match.`,
    );
  }
}

/**
 * Pembuat definisi filter. Satu definisi bisa dipakai engine server (Prisma)
 * maupun sumber data in-memory.
 *
 * @example
 * filter.select('status', 'Status', { field: 'status', options: STATUS })
 * filter.multi('kategori', 'Kategori', { field: 'kategoriId', options: loadKategori, allowExclude: true })
 * filter.dateRange('dibuat', 'Tanggal Dibuat', { field: 'createdAt' })
 */
export const filter = {
  select<TWhere = unknown, TRow = any>(
    id: string,
    label: string,
    opts: SelectFilterOptions<TWhere, TRow>,
  ): FilterDefinition<TWhere, TRow> {
    assertTarget(id, opts);
    return { id, label, type: 'select', operator: '=', ...opts };
  },

  multi<TWhere = unknown, TRow = any>(
    id: string,
    label: string,
    opts: MultiFilterOptions<TWhere, TRow>,
  ): FilterDefinition<TWhere, TRow> {
    assertTarget(id, opts);
    return { id, label, type: 'multi', searchThreshold: 5, ...opts };
  },

  date<TWhere = unknown, TRow = any>(
    id: string,
    label: string,
    opts: DateFilterOptions<TWhere, TRow>,
  ): FilterDefinition<TWhere, TRow> {
    assertTarget(id, opts);
    return { id, label, type: 'date', format: 'date', operator: '=', ...opts };
  },

  dateRange<TWhere = unknown, TRow = any>(
    id: string,
    label: string,
    opts: DateRangeFilterOptions<TWhere, TRow>,
  ): FilterDefinition<TWhere, TRow> {
    assertTarget(id, opts);
    return { id, label, type: 'dateRange', format: 'date', ...opts };
  },
};

// ---------------------------------------------------------------------------
// Normalisasi nilai
// ---------------------------------------------------------------------------

/** `true` bila nilai filter tidak berisi apa-apa (0 dan '0' tetap dianggap terisi). */
export function isEmptyFilterValue(value: FilterValue | undefined | null): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value === 'string') return false;
  if ('values' in value) return value.values.length === 0;
  return !value.from && !value.to;
}

export function castValue(raw: string, cast: ValueCast | undefined): string | number | boolean {
  if (cast === 'number') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (cast === 'boolean') return raw === 'true' || raw === '1';
  return raw;
}

function inferCast(options: OptionsSource): ValueCast | undefined {
  if (!Array.isArray(options) || options.length === 0) return undefined;
  const t = typeof options[0]!.value;
  return t === 'number' ? 'number' : t === 'boolean' ? 'boolean' : 'string';
}

export function effectiveCast(def: FilterDefinition): ValueCast | undefined {
  if (def.type !== 'select' && def.type !== 'multi') return undefined;
  return def.cast ?? inferCast(def.options);
}

/**
 * Ubah nilai mentah (dari URL) menjadi nilai siap pakai sesuai tipe filter.
 * Mengembalikan `undefined` bila kosong — artinya filter tidak diterapkan.
 * Rentang yang terbalik (to < from) otomatis ditukar.
 */
export function resolveFilterValue(
  def: FilterDefinition,
  raw: FilterValue | undefined,
): ResolvedValue<FilterType> | undefined {
  if (isEmptyFilterValue(raw)) return undefined;
  const cast = effectiveCast(def);

  switch (def.type) {
    case 'select':
    case 'date': {
      if (typeof raw !== 'string') return undefined;
      return def.type === 'select' ? castValue(raw, cast) : raw;
    }
    case 'multi': {
      const mv = raw as MultiValue;
      if (!mv || !Array.isArray(mv.values)) return undefined;
      return {
        values: mv.values.map((v) => castValue(String(v), cast)),
        exclude: def.allowExclude ? Boolean(mv.exclude) : false,
      };
    }
    case 'dateRange': {
      const rv = raw as RangeValue;
      let from = rv?.from || null;
      let to = rv?.to || null;
      if (from && to && from > to) [from, to] = [to, from];
      return { from, to };
    }
  }
}

// ---------------------------------------------------------------------------
// Schema (untuk dikirim ke client)
// ---------------------------------------------------------------------------

export async function resolveOptions(
  source: OptionsSource,
  ctx: FilterContext,
): Promise<FilterOption[]> {
  return typeof source === 'function' ? await source(ctx) : source;
}

/** Hitung schema filter (opsi + visibilitas) untuk nilai filter saat ini. */
export async function describeFilters(
  defs: FilterDefinition[],
  ctx: FilterContext,
): Promise<FilterSchema[]> {
  return Promise.all(
    defs.map(async (def): Promise<FilterSchema> => {
      const visible =
        typeof def.visible === 'function' ? def.visible(ctx) : (def.visible ?? true);
      const dependsOn =
        def.dependsOn === undefined
          ? undefined
          : Array.isArray(def.dependsOn)
            ? def.dependsOn
            : [def.dependsOn];
      const base: FilterSchema = { id: def.id, label: def.label, type: def.type, visible, dependsOn };

      if (def.type === 'select' || def.type === 'multi') {
        // Filter tersembunyi tidak perlu memuat opsi (hemat query).
        base.options = visible ? await resolveOptions(def.options, ctx) : [];
        if (def.type === 'multi') {
          base.allowExclude = def.allowExclude ?? false;
          base.searchThreshold = def.searchThreshold ?? null;
        }
      } else {
        base.format = def.format ?? 'date';
        base.min = def.min;
        base.max = def.max;
      }
      return base;
    }),
  );
}
