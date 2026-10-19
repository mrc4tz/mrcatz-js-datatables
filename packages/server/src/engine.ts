import {
  describeFilters,
  normalizeSearch,
  parseTableQuery,
  resolveFilterValue,
  type FilterContext,
  type FilterDefinition,
  type FilterType,
  type FilterValue,
  type RawQuery,
  type SearchConfig,
  type SortRule,
  type TablePage,
  type TableQuery,
  type TableSchema,
  type UtcOffset,
} from '@mrcatz/datatable-core';
import { DataTableConfigError } from './errors';
import { and, filterWhere, orderBy, searchWhere, type Where } from './prisma-where';
import {
  buildRelevanceSql,
  validateRelevance,
  type RawExecutor,
  type RelevanceConfig,
} from './relevance';

/** Bagian delegate Prisma yang dipakai engine (`prisma.user`, `prisma.laporan`, ...). */
export interface PrismaDelegate<TRow> {
  findMany(args: any): Promise<TRow[]>;
  count(args: any): Promise<number>;
}

export interface DataTableDefinition<TRow, TCtx> {
  /** Delegate model Prisma, mis. `prisma.user`. */
  model: PrismaDelegate<TRow>;
  /**
   * Kondisi dasar yang selalu berlaku (pengganti `baseQuery()`), mis. scoping
   * per instansi atau soft-delete. Bisa bergantung pada konteks request.
   */
  baseWhere?: Where | ((ctx: TCtx) => Where | undefined);
  /** Diteruskan apa adanya ke `findMany` (pilih salah satu). */
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;

  search?: SearchConfig & {
    /** Urutkan hasil pencarian berdasarkan skor relevansi (PostgreSQL). */
    relevance?: RelevanceConfig & { db: RawExecutor };
  };
  filters?: FilterDefinition<Where, TRow>[];

  /**
   * Daftar kunci yang boleh dipakai untuk sort. Sangat disarankan diisi —
   * tanpa daftar ini, kunci apa pun yang lolos validasi nama akan diteruskan
   * ke Prisma.
   */
  sortable?: string[];
  /** Urutan bila pengguna belum memilih (pengganti `setDefaultOrder`). */
  defaultSort?: SortRule[];
  /** Urutan penentu terakhir agar pagination stabil. Default `[{ key: primaryKey, dir: 'asc' }]`. */
  tiebreaker?: SortRule[] | false;
  primaryKey?: string;

  /** Jumlah baris per halaman bila client tidak mengirim `limit`. Default 10. */
  defaultLimit?: number;
  /** Batas atas `limit` per request. Default 100. */
  maxLimit?: number;
  /** Batas baris untuk `exportRows`. Default 10_000. */
  exportLimit?: number;
  /** Prefix query string (multi-tabel di satu halaman). */
  prefix?: string;

  /** `mode: 'insensitive'` pada pencarian teks. Matikan untuk MySQL/SQLite. Default true. */
  caseInsensitive?: boolean;
  /** Offset zona waktu untuk filter tanggal, mis. `'+08:00'` (WITA). */
  utcOffset?: UtcOffset;
}

export interface QueryOptions<TCtx> {
  context?: TCtx;
}

/**
 * Definisikan tabel data di sisi server (pengganti `MrCatzDataTablesComponent`
 * + `configTable()` + `setFilter()` versi Laravel).
 *
 * @example
 * const penggunaTable = defineDataTable({
 *   model: prisma.user,
 *   search: { columns: ['nama', 'email', { field: 'nik', mode: 'startsWith' }] },
 *   filters: [filter.select('role', 'Peran', { field: 'role', options: ROLES })],
 *   sortable: ['nama', 'email', 'createdAt'],
 *   defaultSort: [{ key: 'createdAt', dir: 'desc' }],
 * });
 *
 * // di controller:
 * return penggunaTable.query(req.query);
 */
export function defineDataTable<TRow, TCtx = undefined>(def: DataTableDefinition<TRow, TCtx>) {
  const search = normalizeSearch(def.search);
  const relevance = def.search?.relevance;
  if (relevance) validateRelevance(relevance, search);

  const filters = def.filters ?? [];
  const ids = new Set<string>();
  for (const f of filters) {
    if (ids.has(f.id)) throw new DataTableConfigError(`Id filter duplikat: "${f.id}"`);
    ids.add(f.id);
  }

  const pk = def.primaryKey ?? relevance?.primaryKey ?? 'id';
  const sortable = def.sortable ? new Set(def.sortable) : null;
  const tiebreaker = def.tiebreaker === false ? [] : (def.tiebreaker ?? [{ key: pk, dir: 'asc' as const }]);
  const whereOpts = { insensitive: def.caseInsensitive ?? true, utcOffset: def.utcOffset };
  const filterTypes = Object.fromEntries(filters.map((f) => [f.id, f.type])) as Record<string, FilterType>;
  const shape = def.select ? { select: def.select } : def.include ? { include: def.include } : {};

  function parse(raw: RawQuery | TableQuery, limitCap = def.maxLimit ?? 100): TableQuery {
    if (!(raw instanceof URLSearchParams) && isTableQuery(raw)) {
      return { ...raw, limit: Math.min(Math.max(1, raw.limit), limitCap) };
    }
    return parseTableQuery(raw, {
      prefix: def.prefix,
      defaultLimit: def.defaultLimit ?? 10,
      maxLimit: limitCap,
      filterTypes,
    });
  }

  function filterCtx(q: TableQuery): FilterContext {
    return { values: q.filters as Record<string, FilterValue | undefined> };
  }

  /** where gabungan: dasar + filter (+ pencarian bila `withSearch`). */
  function buildWhere(q: TableQuery, ctx: TCtx, withSearch: boolean): Where | undefined {
    const base = typeof def.baseWhere === 'function' ? def.baseWhere(ctx) : def.baseWhere;
    const fctx = filterCtx(q);
    const parts = filters.map((f) => {
      const value = resolveFilterValue(f, q.filters[f.id]);
      return value === undefined ? undefined : filterWhere(f, value, fctx, whereOpts);
    });
    return and([base, ...parts, withSearch ? searchWhere(q.search, search, whereOpts) : undefined]);
  }

  function buildOrder(q: TableQuery): Where[] {
    const userSort = q.sort.length ? q.sort : (def.defaultSort ?? []);
    const seen = new Set(userSort.map((s) => s.key));
    // Kunci default & tiebreaker didefinisikan developer → tidak perlu lolos whitelist.
    const userPart = orderBy(q.sort, sortable);
    const devPart = orderBy(
      [...(q.sort.length ? [] : (def.defaultSort ?? [])), ...tiebreaker.filter((t) => !seen.has(t.key))],
      null,
    );
    return [...userPart, ...devPart];
  }

  function meta(q: TableQuery, total: number) {
    return {
      total,
      page: q.page,
      limit: q.limit,
      totalPages: Math.max(1, Math.ceil(total / q.limit)),
      hasMore: q.page * q.limit < total,
    };
  }

  async function runRelevance(q: TableQuery, ctx: TCtx): Promise<TablePage<TRow> | null> {
    if (!relevance || !q.search || q.sort.length) return null;
    const built = buildRelevanceSql(q.search, relevance, search);
    if (!built) return null;

    const scored = (await relevance.db.$queryRawUnsafe(built.sql, ...built.params)) as Array<{
      id: unknown;
      score: unknown;
    }>;
    const score = new Map(scored.map((r) => [String(r.id), Number(r.score)]));
    const where = and([buildWhere(q, ctx, false), { [pk]: { in: scored.map((r) => r.id) } }]);

    const matching = (await def.model.findMany({ where, select: { [pk]: true } })) as Array<Record<string, unknown>>;
    const orderedIds = matching
      .map((r) => r[pk])
      .sort((a, b) => (score.get(String(b)) ?? 0) - (score.get(String(a)) ?? 0));

    const pageIds = orderedIds.slice((q.page - 1) * q.limit, q.page * q.limit);
    const rows = pageIds.length
      ? await def.model.findMany({ where: { [pk]: { in: pageIds } }, ...shape })
      : [];
    const pos = new Map(pageIds.map((id, i) => [String(id), i]));
    rows.sort(
      (a, b) =>
        (pos.get(String((a as Record<string, unknown>)[pk])) ?? 0) -
        (pos.get(String((b as Record<string, unknown>)[pk])) ?? 0),
    );
    return { data: rows, meta: meta(q, orderedIds.length) };
  }

  async function run(q: TableQuery, ctx: TCtx): Promise<TablePage<TRow>> {
    const ranked = await runRelevance(q, ctx);
    if (ranked) return ranked;

    // Mode relevansi tetap memakai pencarian Prisma bila pengguna mengurutkan kolom.
    const where = buildWhere(q, ctx, true);
    const [data, total] = await Promise.all([
      def.model.findMany({
        where,
        orderBy: buildOrder(q),
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        ...shape,
      }),
      def.model.count({ where }),
    ]);
    return { data, meta: meta(q, total) };
  }

  return {
    /** Parse query mentah (`req.query` / URLSearchParams) menjadi `TableQuery` tervalidasi. */
    parse: (raw: RawQuery | TableQuery) => parse(raw),

    /** Ambil satu halaman data. */
    query(raw: RawQuery | TableQuery, opts: QueryOptions<TCtx> = {}): Promise<TablePage<TRow>> {
      return run(parse(raw), opts.context as TCtx);
    },

    /** Semua baris hasil filter + pencarian (tanpa pagination) untuk export. */
    async exportRows(raw: RawQuery | TableQuery, opts: QueryOptions<TCtx> = {}): Promise<TRow[]> {
      const limit = def.exportLimit ?? 10_000;
      const q = { ...parse(raw, limit), page: 1, limit };
      return (await run(q, opts.context as TCtx)).data;
    },

    /** Schema filter (opsi + visibilitas) untuk nilai filter saat ini. */
    async describe(raw: RawQuery | TableQuery = {}): Promise<TableSchema> {
      return { filters: await describeFilters(filters as FilterDefinition[], filterCtx(parse(raw))) };
    },

    /** `where` Prisma yang sama dengan tabel — berguna untuk aksi massal "semua hasil filter". */
    where(raw: RawQuery | TableQuery, opts: QueryOptions<TCtx> = {}): Where | undefined {
      return buildWhere(parse(raw), opts.context as TCtx, true);
    },
  };
}

export type DataTable<TRow, TCtx = undefined> = ReturnType<typeof defineDataTable<TRow, TCtx>>;

function isTableQuery(v: unknown): v is TableQuery {
  const o = v as TableQuery;
  return (
    typeof o === 'object' &&
    o !== null &&
    typeof o.page === 'number' &&
    typeof o.limit === 'number' &&
    Array.isArray(o.sort) &&
    typeof o.filters === 'object'
  );
}
