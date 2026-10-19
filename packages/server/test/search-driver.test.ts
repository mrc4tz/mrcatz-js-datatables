import { describe, expect, it, vi } from 'vitest';
import {
  buildRelevanceSql,
  DataTableConfigError,
  DataTableQueryError,
  defineDataTable,
  filter,
  type FilterDefinition,
  type SearchDriver,
  type Where,
} from '../src';
import {
  meiliValue,
  meilisearchDriver,
  pushdownBlocker,
  meilisearchSettings,
  syncMeilisearchSettings,
  type MeilisearchClientLike,
} from '../src/meilisearch';
import { normalizeSearch } from '@mrcatz/datatable-core';

type Row = { id: number; nama: string };

/** Model Prisma palsu yang benar-benar menerapkan `id in` (cukup untuk pipeline peringkat). */
function idModel(rows: Row[]) {
  const pick = (args: any) => {
    const inIds = findIn(args.where);
    return inIds ? rows.filter((r) => inIds.includes(r.id)) : rows;
  };
  return {
    findMany: vi.fn(async (args: any) => {
      const list = pick(args);
      return args.select ? list.map((r) => ({ id: r.id })) : list;
    }),
    count: vi.fn(async (args: any) => pick(args).length),
  };
}

function findIn(where: any): unknown[] | undefined {
  if (!where) return undefined;
  if (where.id?.in) return where.id.in;
  for (const w of where.AND ?? []) {
    const r = findIn(w);
    if (r) return r;
  }
  return undefined;
}

const ROWS: Row[] = [1, 2, 3, 4].map((id) => ({ id, nama: `n${id}` }));

function fakeMeili(hits: Array<Record<string, unknown>>) {
  const search = vi.fn(async (_q: string, _o?: any) => ({ hits }));
  const updateSettings = vi.fn(async (_s: unknown) => ({ taskUid: 1 }));
  const index = vi.fn((_uid: string) => ({ search, updateSettings }));
  const client: MeilisearchClientLike = { index };
  return { client, index, search, updateSettings };
}

describe('SearchDriver generik', () => {
  it('memakai urutan id dari driver + filter sisa di SQL + pagination', async () => {
    const model = idModel(ROWS);
    const driver: SearchDriver = {
      name: 'custom',
      search: vi.fn(async () => ({ ids: [3, 1, 4, 2], pushedFilters: ['status'] })),
    };
    const table = defineDataTable({
      model,
      search: { columns: ['nama'], driver },
      filters: [
        filter.select('status', 'Status', { field: 'status', options: [{ value: 'a', label: 'A' }] }),
        filter.select('tipe', 'Tipe', { field: 'tipe', options: [{ value: 'x', label: 'X' }] }),
      ],
    });

    const page = await table.query({ search: 'n', limit: '2', page: '1', 'f.status': 'a', 'f.tipe': 'x' });
    expect(page.data.map((r) => r.id)).toEqual([3, 1]);
    expect(page.meta).toMatchObject({ total: 4, totalPages: 2, hasMore: true });

    // filter yang di-pushdown tidak diterapkan lagi; filter lain tetap di SQL
    const where = model.findMany.mock.calls[0]![0].where;
    expect(where.AND).toEqual([{ tipe: { equals: 'x' } }, { id: { in: [3, 1, 4, 2] } }]);

    const page2 = await table.query({ search: 'n', limit: '2', page: '2' });
    expect(page2.data.map((r) => r.id)).toEqual([4, 2]);

    const req = (driver.search as any).mock.calls[0][0];
    expect(req.search).toBe('n');
    expect(req.primaryKey).toBe('id');
    expect(req.filters.map((f: any) => f.def.id)).toEqual(['status', 'tipe']);
  });

  it('sort pengguna: id driver jadi filter, urutan dari Prisma', async () => {
    const model = idModel(ROWS);
    const table = defineDataTable({
      model,
      sortable: ['nama'],
      search: { columns: ['nama'], driver: { name: 'x', search: async () => ({ ids: [2, 1] }) } },
    });
    await table.query({ search: 'n', sort: 'nama:desc' });
    const args = model.findMany.mock.calls[0]![0];
    expect(args.where).toEqual({ id: { in: [2, 1] } });
    expect(args.orderBy).toEqual([{ nama: 'desc' }, { id: 'asc' }]);
    expect(args.take).toBe(10);
  });

  it('tanpa kata kunci / driver mengembalikan null → jalur Prisma biasa', async () => {
    const model = idModel(ROWS);
    const search = vi.fn(async () => null);
    const table = defineDataTable({ model, search: { columns: ['nama'], driver: { name: 'x', search } } });
    await table.query({});
    expect(search).not.toHaveBeenCalled();
    await table.query({ search: 'budi' });
    expect(search).toHaveBeenCalledTimes(1);
    expect(model.findMany.mock.calls[1]![0].where).toEqual({ OR: [{ nama: { contains: 'budi', mode: 'insensitive' } }] });
  });

  it('driver + relevance ditolak; validate driver dipanggil saat definisi', () => {
    const validate = vi.fn();
    defineDataTable({ model: idModel([]), search: { columns: ['nama'], driver: { name: 'x', search: async () => null, validate } } });
    expect(validate).toHaveBeenCalledWith(expect.objectContaining({ primaryKey: 'id', sortable: null }));

    expect(() =>
      defineDataTable({
        model: idModel([]),
        search: {
          columns: ['nama'],
          relevance: { table: 'users', db: { $queryRawUnsafe: vi.fn() } },
          driver: { name: 'x', search: async () => null },
        },
      }),
    ).toThrow(DataTableConfigError);
  });
});

describe('meilisearchDriver', () => {
  const filters: FilterDefinition<Where>[] = [
    filter.select('status', 'Status', { field: 'status', options: [{ value: 'aktif', label: 'Aktif' }] }),
    filter.select('stok', 'Stok', { field: 'stok', operator: '>=', options: [{ value: 1, label: '1' }] }),
    filter.select('nama', 'Nama', { field: 'nama', operator: 'contains', options: [] }),
    filter.multi('kat', 'Kategori', { field: 'kategoriId', options: [{ value: 1, label: 'A' }], allowExclude: true }),
    filter.date('dibuat', 'Dibuat', { field: 'createdAt' }),
    filter.dateRange('kirim', 'Dikirim', { field: 'shippedAt', format: 'month' }),
    filter.date('tanpaMap', 'Tanpa map', { field: 'paidAt', operator: '!=' }),
    filter.select('lampiran', 'Lampiran', {
      options: [{ value: true, label: 'Ya' }],
      where: (v) => (v ? { lampiran: { some: {} } } : undefined),
    }),
  ];

  it('mode auto: pushdown filter yang bisa diterjemahkan, sisanya di SQL', async () => {
    const meili = fakeMeili([{ id: 2 }, { id: 1 }]);
    const onFallback = vi.fn();
    const model = idModel(ROWS);
    const table = defineDataTable({
      model,
      utcOffset: '+08:00',
      filters,
      search: {
        columns: ['nama'],
        driver: meilisearchDriver({
          client: meili.client,
          index: 'products',
          maxResults: 50,
          dateFields: { createdAt: 'createdAtTs', kirim: 'shippedAtTs' },
          searchParams: { matchingStrategy: 'all' },
          onFallback,
        }),
      },
    });

    const page = await table.query({
      search: 'kopi',
      'f.status': 'aktif',
      'f.stok': '5',
      'f.nama': 'ko"pi',
      'f.kat': ['1', '2'],
      'f.kat.not': '1',
      'f.dibuat': '2026-10-19',
      'f.kirim.from': '2026-01',
      'f.tanpaMap': '2026-01-01',
      'f.lampiran': 'true',
    });
    expect(page.data.map((r) => r.id)).toEqual([2, 1]);

    expect(meili.index).toHaveBeenCalledWith('products');
    const [q, opts] = meili.search.mock.calls[0]!;
    expect(q).toBe('kopi');
    expect(opts).toEqual({
      matchingStrategy: 'all',
      limit: 50,
      attributesToRetrieve: ['id'],
      filter: [
        'status = "aktif"',
        'stok >= 5',
        'kategoriId NOT IN [1, 2]',
        // 2026-10-19 WITA = [2026-10-18T16:00Z, 2026-10-19T16:00Z)
        `(createdAtTs >= ${Date.UTC(2026, 9, 18, 16) / 1000} AND createdAtTs < ${Date.UTC(2026, 9, 19, 16) / 1000})`,
        `(shippedAtTs >= ${Date.UTC(2025, 11, 31, 16) / 1000})`,
      ].join(' AND '),
    });

    // nama (contains), tanpaMap (tanpa dateFields), lampiran (where) → SQL
    expect(onFallback.mock.calls.map((c) => c[0])).toEqual(['nama', 'tanpaMap', 'lampiran']);
    const where = model.findMany.mock.calls[0]![0].where;
    expect([...where.AND[0].AND, where.AND[1]]).toEqual([
      { nama: { contains: 'ko"pi', mode: 'insensitive' } },
      { NOT: { paidAt: { gte: new Date('2025-12-31T16:00:00Z'), lt: new Date('2026-01-01T16:00:00Z') } } },
      { lampiran: { some: {} } },
      { id: { in: [2, 1] } },
    ]);
  });

  it('mode never: semua filter di SQL, tanpa parameter filter', async () => {
    const meili = fakeMeili([{ id: 1 }]);
    const model = idModel(ROWS);
    const table = defineDataTable({
      model,
      filters: [filters[0]!],
      search: { columns: ['nama'], driver: meilisearchDriver({ client: meili.client, index: 'p', filterPushdown: 'never' }) },
    });
    await table.query({ search: 'x', 'f.status': 'aktif' });
    expect(meili.search.mock.calls[0]![1].filter).toBeUndefined();
    expect(model.findMany.mock.calls[0]![0].where.AND[0]).toEqual({ status: { equals: 'aktif' } });
  });

  it('mode always: filter yang tidak bisa diterjemahkan ditolak saat definisi', () => {
    const make = (fs: typeof filters) =>
      defineDataTable({
        model: idModel([]),
        filters: fs,
        search: {
          columns: ['nama'],
          driver: meilisearchDriver({
            client: fakeMeili([]).client,
            index: 'p',
            filterPushdown: 'always',
            dateFields: { createdAt: 'createdAtTs' },
          }),
        },
      });
    expect(() => make([filters[0]!, filters[3]!, filters[4]!])).not.toThrow();
    expect(() => make([filters[2]!])).toThrow(/contains/);
    expect(() => make([filters[6]!])).toThrow(/dateFields/);
    expect(() => make([filters[7]!])).toThrow(DataTableConfigError);
    expect(pushdownBlocker(filter.date('jam', 'Jam', { field: 'at', format: 'timeHm' }), { at: 'atTs' })).toMatch(
      /format jam/,
    );
    expect(pushdownBlocker(filters[4]!, { createdAt: 'createdAtTs' })).toBeNull();
  });

  it('validasi opsi, castId, dan tanggal tidak valid → 400', async () => {
    const client = fakeMeili([]).client;
    expect(() => meilisearchDriver({ client, index: 'p', filterPushdown: 'kadang' as never })).toThrow(DataTableConfigError);
    expect(() => meilisearchDriver({ client, index: 'p', dateFields: { a: 'x; DROP' } })).toThrow(DataTableConfigError);
    expect(() => meilisearchDriver({ client, index: '' })).toThrow(DataTableConfigError);

    const meili = fakeMeili([{ uid: '3' }, { uid: '1' }, { other: 1 }]);
    const model = idModel(ROWS);
    const table = defineDataTable({
      model,
      filters: [filters[4]!],
      search: {
        columns: ['nama'],
        driver: meilisearchDriver({
          client: meili.client,
          index: 'p',
          primaryKey: 'uid',
          castId: Number,
          dateFields: { dibuat: 'createdAtTs' },
        }),
      },
    });
    const page = await table.query({ search: 'x' });
    expect(page.data.map((r) => r.id)).toEqual([3, 1]);
    expect(meili.search.mock.calls[0]![1].attributesToRetrieve).toEqual(['uid']);
    await expect(table.query({ search: 'x', 'f.dibuat': 'kemarin' })).rejects.toBeInstanceOf(DataTableQueryError);
  });

  it('meiliValue meng-escape string', () => {
    expect(meiliValue(5)).toBe('5');
    expect(meiliValue(false)).toBe('false');
    expect(meiliValue('a"b\\c')).toBe('"a\\"b\\\\c"');
  });
});

describe('syncMeilisearchSettings', () => {
  it('menyusun searchable (urut bobot), filterable, sortable, typoTolerance', async () => {
    const meili = fakeMeili([]);
    const table = defineDataTable({
      model: idModel([]),
      sortable: ['nama', 'createdAt'],
      filters: [
        filter.select('status', 'Status', { field: 'status', options: [] }),
        filter.multi('kat', 'Kategori', { field: 'kategoriId', options: [] }),
        filter.dateRange('dibuat', 'Dibuat', { field: 'createdAt' }),
        filter.select('cb', 'Callback', { options: [], where: () => undefined }),
      ],
      search: {
        columns: ['sku', { field: 'nama', weight: 5 }, { field: 'kategori.nama', weight: 2 }],
        typoTolerance: { driver: 'trigram', minWordLength: 5 },
        driver: meilisearchDriver({ client: meili.client, index: 'products', dateFields: { createdAt: 'createdAtTs' } }),
      },
    });

    const expected = {
      searchableAttributes: ['nama', 'kategori.nama', 'sku'],
      filterableAttributes: ['status', 'kategoriId', 'createdAtTs'],
      sortableAttributes: ['nama', 'createdAt'],
      typoTolerance: { enabled: true, minWordSizeForTypos: { oneTypo: 5, twoTypos: 10 } },
    };
    expect(meilisearchSettings(table)).toEqual(expected);

    // client & index default dari driver tabel
    expect(await syncMeilisearchSettings(table)).toEqual(expected);
    expect(meili.index).toHaveBeenLastCalledWith('products');
    expect(meili.updateSettings).toHaveBeenCalledWith(expected);

    // client/index eksplisit + dryRun
    const other = fakeMeili([]);
    await syncMeilisearchSettings(table, other.client, 'lain', { dryRun: true });
    expect(other.updateSettings).not.toHaveBeenCalled();
  });

  it('tanpa driver Meilisearch wajib memberi client & index', async () => {
    const table = defineDataTable({ model: idModel([]), search: { columns: ['nama'] } });
    await expect(syncMeilisearchSettings(table)).rejects.toBeInstanceOf(DataTableConfigError);
    const meili = fakeMeili([]);
    const s = await syncMeilisearchSettings(table, meili.client, 'x');
    expect(s).toEqual({ searchableAttributes: ['nama'] });
  });
});

describe('perilaku konfigurasi', () => {
  it("pg_trgm tanpa relevance → DataTableConfigError", () => {
    expect(() =>
      defineDataTable({ model: idModel([]), search: { columns: ['nama'], typoTolerance: { driver: 'pg_trgm' } } }),
    ).toThrow(/pg_trgm/);
    expect(() =>
      defineDataTable({
        model: idModel([]),
        search: {
          columns: ['nama'],
          typoTolerance: { driver: 'pg_trgm' },
          relevance: { table: 'users', db: { $queryRawUnsafe: vi.fn() } },
        },
      }),
    ).not.toThrow();
  });

  it('format jam berbasis field ditolak; dengan where diterima', async () => {
    expect(() =>
      defineDataTable({ model: idModel([]), filters: [filter.date('jam', 'Jam', { field: 'at', format: 'timeHm' })] }),
    ).toThrow(/where/);
    expect(() =>
      defineDataTable({ model: idModel([]), filters: [filter.dateRange('jam', 'Jam', { field: 'at', format: 'time' })] }),
    ).toThrow(DataTableConfigError);

    const model = idModel([]);
    const { compareBounds, periodOf } = await import('../src');
    const table = defineDataTable({
      model,
      filters: [
        filter.date('jam', 'Jam', {
          format: 'timeHm',
          operator: '>=',
          where: (v) => {
            const b = compareBounds(periodOf(v, 'timeHm'), '>=');
            return { jamBuka: b };
          },
        }),
      ],
    });
    await table.query({ 'f.jam': '08:30' });
    expect(model.findMany.mock.calls[0]![0].where).toEqual({ jamBuka: { gte: new Date('1970-01-01T08:30:00Z') } });
  });

  it('operator tanggal dinamis dipakai engine Prisma; describe mengevaluasi min/max', async () => {
    const model = idModel([]);
    const table = defineDataTable({
      model,
      utcOffset: 'Z',
      filters: [
        filter.select('arah', 'Arah', { field: 'arah', options: [{ value: 'sesudah', label: 'Sesudah' }], where: () => undefined }),
        filter.date('tgl', 'Tgl', {
          field: 'tgl',
          dependsOn: 'arah',
          operator: (ctx) => (ctx.values.arah === 'sesudah' ? '>' : '<'),
          min: (ctx) => (ctx.values.arah === 'sesudah' ? '2026-01-01' : undefined),
          max: '2026-12-31',
        }),
      ],
    });
    await table.query({ 'f.tgl': '2026-05-01', 'f.arah': 'sesudah' });
    expect(model.findMany.mock.calls[0]![0].where).toEqual({ tgl: { gte: new Date('2026-05-02T00:00:00Z') } });
    await table.query({ 'f.tgl': '2026-05-01' });
    expect(model.findMany.mock.calls[1]![0].where).toEqual({ tgl: { lt: new Date('2026-05-01T00:00:00Z') } });

    const schema = await table.describe({ 'f.arah': 'sesudah' });
    expect(schema.filters[1]).toMatchObject({ min: '2026-01-01', max: '2026-12-31' });
    expect((await table.describe()).filters[1]!.min).toBeUndefined();
  });
});

describe('relevansi dengan joins', () => {
  const db = { $queryRawUnsafe: vi.fn() };

  it('membangun LEFT JOIN, kolom alias.kolom, dan MAX(score) per id', () => {
    const cfg = {
      table: 'orders',
      joins: [
        { table: 'customers', alias: 'c', on: 'c.id = orders.customer_id' },
        { table: 'public.regions', on: ['regions.id = c.region_id'], type: 'inner' as const },
      ],
    };
    const s = normalizeSearch({
      columns: [{ field: 'nomor', weight: 2 }, { field: 'customer.name', column: 'c.name', weight: 3 }, 'regions.name'],
    });
    const built = buildRelevanceSql('budi', cfg, s)!;
    expect(built.sql).toContain(
      'FROM "orders" LEFT JOIN "customers" AS "c" ON "c"."id" = "orders"."customer_id" ' +
        'INNER JOIN "public"."regions" AS "regions" ON "regions"."id" = "c"."region_id"',
    );
    expect(built.sql).toContain('LOWER(CAST("orders"."nomor" AS TEXT))');
    expect(built.sql).toContain('LOWER(CAST("c"."name" AS TEXT))');
    expect(built.sql).toContain('LOWER(CAST("regions"."name" AS TEXT))');
    expect(built.sql).toMatch(/^SELECT id, MAX\(score\) AS score FROM \(SELECT "orders"."id" AS id, /);
    expect(built.sql).toMatch(/\) AS mrc_scored GROUP BY id ORDER BY score DESC LIMIT 2000$/);
    expect(built.params).toEqual(['%budi%', '%budi%', '%budi%']);
  });

  it('defineDataTable menerima kolom relasi bila alias dikenal', () => {
    expect(() =>
      defineDataTable({
        model: idModel([]),
        search: {
          columns: ['nomor', 'c.name'],
          relevance: { table: 'orders', db, joins: [{ table: 'customers', alias: 'c', on: 'c.id = orders.customer_id' }] },
        },
      }),
    ).not.toThrow();
  });

  it.each([
    ['on SQL bebas', { table: 'customers', on: 'c.id = orders.customer_id OR 1=1' }],
    ['on tanpa kualifikasi', { table: 'customers', on: 'id = customer_id' }],
    ['on dengan alias tak dikenal', { table: 'customers', alias: 'c', on: 'x.id = orders.customer_id' }],
    ['tabel tidak valid', { table: 'customers; DROP TABLE x', on: 'customers.id = orders.customer_id' }],
    ['alias tidak valid', { table: 'customers', alias: 'c"', on: 'c.id = orders.customer_id' }],
    ['alias duplikat dengan tabel dasar', { table: 'orders', on: 'orders.id = orders.id' }],
    ['tipe join tidak valid', { table: 'customers', type: 'cross', on: 'customers.id = orders.customer_id' }],
  ])('menolak join: %s', (_label, join) => {
    expect(() =>
      defineDataTable({
        model: idModel([]),
        search: { columns: ['nomor'], relevance: { table: 'orders', db, joins: [join as never] } },
      }),
    ).toThrow(DataTableConfigError);
  });

  it('menolak kolom dengan alias tak dikenal atau terlalu dalam', () => {
    const joins = [{ table: 'customers', alias: 'c', on: 'c.id = orders.customer_id' }];
    for (const col of ['x.name', 'c.addr.city']) {
      expect(() =>
        defineDataTable({ model: idModel([]), search: { columns: [col], relevance: { table: 'orders', db, joins } } }),
      ).toThrow(DataTableConfigError);
    }
  });
});
