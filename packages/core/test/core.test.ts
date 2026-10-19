import { describe, expect, it } from 'vitest';
import {
  createMemoryTable,
  filter,
  highlight,
  parseTableQuery,
  periodOf,
  toCsv,
  toSearchParams,
  trigrams,
  type TableQuery,
} from '../src';

const base: TableQuery = { page: 1, limit: 10, search: '', sort: [], filters: {} };

describe('query string', () => {
  it('round-trip semua jenis filter dengan prefix', () => {
    const q: TableQuery = {
      page: 3,
      limit: 25,
      search: 'budi',
      sort: [{ key: 'nama', dir: 'asc' }, { key: 'createdAt', dir: 'desc' }],
      filters: {
        status: 'aktif',
        kategori: { values: ['1', '3'], exclude: true },
        dibuat: { from: '2026-01-01', to: '2026-01-31' },
      },
    };
    const params = toSearchParams(q, { prefix: 'u_' });
    expect(params.get('u_sort')).toBe('nama:asc,createdAt:desc');
    expect(parseTableQuery(params, { prefix: 'u_' })).toEqual(q);
  });

  it('multi dengan satu nilai tetap multi bila tipenya diketahui', () => {
    const q = parseTableQuery({ 'f.kat': '2' }, { filterTypes: { kat: 'multi' } });
    expect(q.filters.kat).toEqual({ values: ['2'], exclude: false });
  });

  it('membatasi limit dan memakai default', () => {
    const q = parseTableQuery({ limit: '99999', page: '-1' }, { maxLimit: 50 });
    expect(q.limit).toBe(50);
    expect(q.page).toBe(1);
  });

  it('mengabaikan param milik tabel lain', () => {
    const q = parseTableQuery({ search: 'x', 'b_search': 'y' }, { prefix: 'b_' });
    expect(q.search).toBe('y');
  });
});

describe('highlight', () => {
  it('mempertahankan huruf asli dan menggabung kecocokan berdempetan', () => {
    expect(highlight('Coba banget', 'cob')).toEqual([
      { text: 'Cob', match: true },
      { text: 'a banget', match: false },
    ]);
  });
  it('tidak menghasilkan HTML', () => {
    const segs = highlight('<script>', 'script');
    expect(segs.map((s) => s.text).join('')).toBe('<script>');
  });
});

describe('dates', () => {
  it('periode bulan dengan offset WITA', () => {
    const p = periodOf('2026-10', 'month', '+08:00');
    expect(p.start.toISOString()).toBe('2026-09-30T16:00:00.000Z');
    expect(p.end.toISOString()).toBe('2026-10-31T16:00:00.000Z');
  });
  it('menolak format salah', () => {
    expect(() => periodOf('2026/10/01', 'date')).toThrow();
  });
});

describe('memory table', () => {
  const rows = [
    { id: 1, nama: 'Budi Santoso', status: 'aktif', kat: 1, at: '2026-01-05T02:00:00Z' },
    { id: 2, nama: 'Siti Aminah', status: 'nonaktif', kat: 2, at: '2026-02-10T02:00:00Z' },
    { id: 3, nama: 'Budi Hartono', status: 'aktif', kat: 3, at: '2026-03-15T02:00:00Z' },
  ];
  const table = createMemoryTable(rows, {
    search: { columns: [{ field: 'nama', weight: 2 }] },
    filters: [
      filter.select('status', 'Status', { field: 'status', options: [{ value: 'aktif', label: 'Aktif' }] }),
      filter.multi('kat', 'Kategori', { field: 'kat', options: [{ value: 1, label: 'A' }], allowExclude: true }),
      filter.dateRange('at', 'Tanggal', { field: 'at', utcOffset: undefined } as never),
    ],
    utcOffset: 'Z',
  });

  it('search semua kata harus cocok', () => {
    expect(table.query({ ...base, search: 'budi hartono' }).data.map((r) => r.id)).toEqual([3]);
  });
  it('filter multi exclude dengan cast angka', () => {
    const r = table.query({ ...base, filters: { kat: { values: ['1'], exclude: true } } });
    expect(r.data.map((x) => x.id)).toEqual([2, 3]);
  });
  it('filter rentang terbuka', () => {
    const r = table.query({ ...base, filters: { at: { from: '2026-02-01' } } });
    expect(r.data.map((x) => x.id)).toEqual([2, 3]);
  });
  it('pagination & meta', () => {
    const r = table.query({ ...base, limit: 2, page: 2 });
    expect(r.meta).toMatchObject({ total: 3, totalPages: 2, hasMore: false });
    expect(r.data).toHaveLength(1);
  });
  it('typo tolerance menemukan salah ketik', () => {
    const fuzzy = createMemoryTable(rows, { search: { columns: ['nama'], typoTolerance: true } });
    expect(fuzzy.query({ ...base, search: 'santosa' }).data[0]?.id).toBe(1);
  });
  it('describe menghitung visibilitas bertingkat', async () => {
    const t = createMemoryTable(rows, {
      filters: [
        filter.select('a', 'A', { field: 'status', options: [] }),
        filter.select('b', 'B', { field: 'kat', options: () => [{ value: 1, label: 'x' }], dependsOn: 'a', visible: (c) => !!c.values.a }),
      ],
    });
    const hidden = await t.describe({ values: {} });
    expect(hidden.filters[1]).toMatchObject({ visible: false, options: [] });
    const shown = await t.describe({ values: { a: 'aktif' } });
    expect(shown.filters[1]).toMatchObject({ visible: true, dependsOn: ['a'] });
  });
});

describe('misc', () => {
  it('trigram', () => expect(trigrams('budi')).toEqual(['bud', 'udi']));
  it('csv menetralkan rumus dan meng-escape', () => {
    expect(toCsv(['a'], [['=1+1'], ['x,"y"']], { bom: false })).toBe('a\r\n\'=1+1\r\n"x,""y"""');
  });
  it('filter tanpa target ditolak', () => {
    expect(() => filter.select('x', 'X', { options: [] })).toThrow(/field, where, atau match/);
  });
});
