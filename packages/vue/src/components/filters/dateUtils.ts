import type { DateFormat, RangeValue } from '@mrcatz/datatable-core';

/** Jenis `<input>` native untuk tiap format tanggal. */
export function inputType(format: DateFormat | undefined): string {
  switch (format) {
    case 'datetime':
      return 'datetime-local';
    case 'month':
      return 'month';
    case 'year':
      return 'number';
    default:
      return 'date';
  }
}

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export type RangePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'thisYear';

/** Rentang preset berdasarkan tanggal lokal hari ini. */
export function presetRange(preset: RangePreset, now = new Date()): RangeValue {
  const day = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return isoDate(d);
  };
  switch (preset) {
    case 'today':
      return { from: day(0), to: day(0) };
    case 'yesterday':
      return { from: day(-1), to: day(-1) };
    case 'last7':
      return { from: day(-6), to: day(0) };
    case 'last30':
      return { from: day(-29), to: day(0) };
    case 'thisMonth':
      return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: day(0) };
    case 'thisYear':
      return { from: `${now.getFullYear()}-01-01`, to: day(0) };
  }
}

export function formatDateValue(value: string, format: DateFormat | undefined, locale: string): string {
  if (format === 'year') return value;
  const d = new Date(format === 'month' ? `${value}-01T00:00` : value.length === 10 ? `${value}T00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  const opts: Intl.DateTimeFormatOptions =
    format === 'month' ? { month: 'long', year: 'numeric' } : format === 'datetime' ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' };
  return new Intl.DateTimeFormat(locale, opts).format(d);
}
