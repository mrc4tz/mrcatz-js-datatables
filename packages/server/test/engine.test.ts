import { describe, expect, it, vi } from 'vitest';
import { buildRelevanceSql, DataTableConfigError, DataTableQueryError, defineDataTable, filter } from '../src';
import { normalizeSearch } from '@mrcatz/datatable-core';

function fakeModel(rows: Record<string, unknown>[] = []) {
  return {
    findMany: vi.fn(async (_args: any) => rows),
    count: vi.fn(async (_args: any) => rows.length),
  };
}

describe('defineDataTable (Prisma)', () => {
  it('menyusun where filter + search + orderBy + pagination', async () => {
    const model = fakeModel([{ id: 1 }]);
    const table = defineDataTable({
      model,
      baseWhere: (ctx: { instansiId: number }) => ({ instansiId: ctx.instansiId }),
      search: { columns: ['nama', 'kategori.nama'] },
      filters: [
        filter.select('status', 'Status', { field: 'status', options: [{ value: 'aktif', label: 'Aktif' }] }),
        filter.multi('kat', 'Kategori', { field: 'kategoriId', options: [{ value: 1, label: 'A' }], allowExclude: true }),
        filter.dateRange('dibuat', 'Dibuat', { field: 'createdAt' }),
      ],
      sortable: ['nama'],
      defaultSort: [{ key: 'createdAt', dir: 'desc' }],
      utcOffset: '+08:00',
    });

    const page = await table.query(
      {
        search: 'budi',
        page: '2',
        limit: '5',
        sort: 'nama:desc',
        'f.status': 'aktif',
        'f.kat': '1',
        'f.kat.not': '1',
        'f.dibuat.from': '2026-01-01',
      },
      { context: { instansiId: 7 } },
    );

    const args = model.findMany.mock.calls[0]![0];
    expect(args.skip).toBe(5);
    expect(args.take).toBe(5);
    expect(args.orderBy).toEqual([{ nama: 'desc' }, { id: 'asc' }]);
    expect(args.where.AND).toEqual([
      { instansiId: 7 },
      { status: { equals: 'aktif' } },
      { kategoriId: { notIn: [1] } },
      { createdAt: { gte: new Date('2025-12-31T16:00:00.000Z') } },
      {
        OR: [
          { nama: { contains: 'budi', mode: 'insensitive' } },
          { kategori: { nama: { contains: 'budi', mode: 'insensitive' } } },
        ],
      },
    ]);
    expect(page.meta).toMatchObject({ page: 2, limit: 5, total: 1 });
  });

  it('menolak sort di luar whitelist dengan error 400', async () => {
    const table = defineDataTable({ model: fakeModel(), sortable: ['nama'] });
    await expect(table.query({ sort: 'password:asc' })).rejects.toBeInstanceOf(DataTableQueryError);
  });

  it('menolak tanggal tidak valid sebagai error 400', async () => {
    const table = defineDataTable({
      model: fakeModel(),
      filters: [filter.date('tgl', 'Tgl', { field: 'tgl' })],
    });
    await expect(table.query({ 'f.tgl': 'kemarin' })).rejects.toBeInstanceOf(DataTableQueryError);
  });

  it('memakai where kustom pada filter', async () => {
    const model = fakeModel();
    const table = defineDataTable({
      model,
      filters: [
        filter.select('punyaLampiran', 'Lampiran', {
          options: [{ value: true, label: 'Ya' }],
          where: (v) => (v ? { lampiran: { some: {} } } : { lampiran: { none: {} } }),
        }),
      ],
    });
    await table.query({ 'f.punyaLampiran': 'true' });
    expect(model.findMany.mock.calls[0]![0].where).toEqual({ lampiran: { some: {} } });
  });

  it('describe memuat opsi dinamis', async () => {
    const table = defineDataTable({
      model: fakeModel(),
      filters: [
        filter.select('kec', 'Kecamatan', { field: 'kecId', options: async () => [{ value: 1, label: 'Murung Pudak' }] }),
      ],
    });
    const schema = await table.describe();
    expect(schema.filters[0]!.options).toEqual([{ value: 1, label: 'Murung Pudak' }]);
  });

  it('mode relevansi mengurutkan berdasarkan skor', async () => {
    const db = { $queryRawUnsafe: vi.fn(async () => [{ id: 2, score: 9 }, { id: 1, score: 3 }]) };
    const model = {
      findMany: vi.fn(async (args: any) =>
        args.select ? [{ id: 1 }, { id: 2 }] : [{ id: 1, nama: 'a' }, { id: 2, nama: 'b' }],
      ),
      count: vi.fn(async () => 0),
    };
    const table = defineDataTable({
      model,
      search: { columns: [{ field: 'nama', weight: 3 }], relevance: { table: 'users', db } },
    });
    const page = await table.query({ search: 'bud' });
    expect(page.data.map((r) => r.id)).toEqual([2, 1]);
    expect(page.meta.total).toBe(2);
  });

  it('relevansi menolak kolom relasi', () => {
    expect(() =>
      defineDataTable({
        model: fakeModel(),
        search: { columns: ['kategori.nama'], relevance: { table: 'x', db: { $queryRawUnsafe: vi.fn() } } },
      }),
    ).toThrow(DataTableConfigError);
  });
});

describe('buildRelevanceSql', () => {
  it('parameterisasi nilai dan escape wildcard LIKE', () => {
    const built = buildRelevanceSql(
      "50%_off'",
      { table: 'public.produk' },
      normalizeSearch({ columns: [{ field: 'nama', weight: 2 }] }),
    )!;
    expect(built.sql).toContain('FROM "public"."produk"');
    expect(built.sql).not.toContain("50%");
    expect(built.params).toEqual(["%50\\%\\_off'%"]);
  });
});
