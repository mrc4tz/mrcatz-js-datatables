import { describe, expect, it } from 'vitest';
import {
  compareBounds,
  createMemoryTable,
  describeFilters,
  filter,
  InvalidDateValueError,
  isTimeFormat,
  parseTimeOfDay,
  periodOf,
  rangeBounds,
  timeOfDay,
  type TableQuery,
} from '../src';

const base: TableQuery = { page: 1, limit: 50, search: '', sort: [], filters: {} };

describe('format jam (time / timeHm)', () => {
  it('parseTimeOfDay → detik sejak tengah malam', () => {
    expect(parseTimeOfDay('00:00')).toBe(0);
    expect(parseTimeOfDay('14:30')).toBe(52200);
    expect(parseTimeOfDay('14:30:15')).toBe(52215);
    expect(() => parseTimeOfDay('24:00')).toThrow(InvalidDateValueError);
    expect(() => parseTimeOfDay('9:30')).toThrow(InvalidDateValueError);
    expect(isTimeFormat('timeHm')).toBe(true);
    expect(isTimeFormat('date')).toBe(false);
  });

  it('periodOf: time = satu detik, timeHm = satu menit, di 1970-01-01 UTC', () => {
    expect(periodOf('08:30:15', 'time')).toEqual({
      start: new Date('1970-01-01T08:30:15Z'),
      end: new Date('1970-01-01T08:30:16Z'),
    });
    expect(periodOf('08:30', 'time')).toEqual({
      start: new Date('1970-01-01T08:30:00Z'),
      end: new Date('1970-01-01T08:31:00Z'),
    });
    expect(periodOf('08:30:59', 'timeHm')).toEqual({
      start: new Date('1970-01-01T08:30:00Z'),
      end: new Date('1970-01-01T08:31:00Z'),
    });
    // utcOffset tidak berpengaruh pada jam murni
    expect(periodOf('08:30', 'timeHm', '+08:00').start).toEqual(new Date('1970-01-01T08:30:00Z'));
    expect(rangeBounds('08:00', '17:00', 'timeHm')).toEqual({
      gte: new Date('1970-01-01T08:00:00Z'),
      lt: new Date('1970-01-01T17:01:00Z'),
    });
    expect(compareBounds(periodOf('12:00', 'timeHm'), '>=')).toEqual({ gte: new Date('1970-01-01T12:00:00Z') });
  });

  it('timeOfDay memakai offset zona waktu', () => {
    expect(timeOfDay(new Date('2026-10-19T01:30:00Z'), '+08:00')).toEqual(new Date('1970-01-01T09:30:00Z'));
    expect(timeOfDay(new Date('2026-10-19T23:30:00Z'), '+08:00')).toEqual(new Date('1970-01-01T07:30:00Z'));
  });

  it('memorySource mendukung filter jam berbasis field', () => {
    const rows = [
      { id: 1, at: new Date('2026-10-19T00:15:00Z'), jam: '08:15:00' }, // 08:15 WITA
      { id: 2, at: new Date('2026-10-19T04:00:00Z'), jam: '12:00:30' }, // 12:00 WITA
      { id: 3, at: new Date('2026-10-20T09:45:00Z'), jam: '17:45:00' }, // 17:45 WITA
    ];
    const table = createMemoryTable(rows, {
      utcOffset: '+08:00',
      filters: [
        filter.date('jamMulai', 'Jam', { field: 'at', format: 'timeHm', operator: '>=' }),
        filter.dateRange('jamKerja', 'Jam kerja', { field: 'at', format: 'timeHm' }),
        filter.date('jamTeks', 'Jam (teks)', { field: 'jam', format: 'time' }),
      ],
    });
    const ids = (filters: TableQuery['filters']) => table.query({ ...base, filters }).data.map((r) => r.id);

    expect(ids({ jamMulai: '12:00' })).toEqual([2, 3]);
    expect(ids({ jamKerja: { from: '08:00', to: '12:00' } })).toEqual([1, 2]);
    expect(ids({ jamTeks: '12:00:30' })).toEqual([2]);
    expect(ids({ jamTeks: '12:00' })).toEqual([2]); // tanpa detik → satu menit
  });
});

describe('batas tanggal & operator dinamis', () => {
  const defs = [
    filter.select('periode', 'Periode', {
      field: 'periode',
      options: [
        { value: '2024', label: '2024' },
        { value: '2025', label: '2025' },
      ],
    }),
    filter.date('tgl', 'Tanggal', {
      field: 'tgl',
      dependsOn: 'periode',
      min: (ctx) => (ctx.values.periode ? `${ctx.values.periode as string}-01-01` : undefined),
      max: (ctx) => (ctx.values.periode ? `${ctx.values.periode as string}-12-31` : undefined),
      operator: (ctx) => (ctx.values.arah === 'sesudah' ? '>=' : '<='),
    }),
    filter.dateRange('rentang', 'Rentang', { field: 'tgl', min: '2020-01-01', max: () => '2030-12-31' }),
  ];

  it('describe mengevaluasi min/max fungsi', async () => {
    const [, tgl, rentang] = await describeFilters(defs, { values: { periode: '2024' } });
    expect(tgl).toMatchObject({ min: '2024-01-01', max: '2024-12-31' });
    expect(rentang).toMatchObject({ min: '2020-01-01', max: '2030-12-31' });
    const [, kosong] = await describeFilters(defs, { values: {} });
    expect(kosong!.min).toBeUndefined();
    expect(kosong!.max).toBeUndefined();
  });

  it('operator dinamis dipakai memorySource', () => {
    const rows = [
      { id: 1, tgl: '2026-01-10T00:00:00Z' },
      { id: 2, tgl: '2026-03-10T00:00:00Z' },
    ];
    const table = createMemoryTable(rows, { filters: defs, utcOffset: 'Z' });
    const ids = (filters: TableQuery['filters']) => table.query({ ...base, filters }).data.map((r) => r.id);
    expect(ids({ tgl: '2026-02-01' })).toEqual([1]);
    expect(ids({ tgl: '2026-02-01', arah: 'sesudah' })).toEqual([2]);
  });
});
