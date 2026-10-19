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

export type RangePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'last6m' | 'thisYear' | 'lastYear';
export const RANGE_PRESETS: RangePreset[] = ['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'last6m', 'thisYear', 'lastYear'];

/** Rentang preset — perhitungan sama dengan `mrcatzDateRange` versi Laravel. */
export function presetRange(preset: RangePreset, now = new Date()): RangeValue {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const shift = (fn: (d: Date) => void) => {
    const d = new Date(today);
    fn(d);
    return isoDate(d);
  };
  const t = isoDate(today);
  switch (preset) {
    case 'today':
      return { from: t, to: t };
    case 'yesterday': {
      const y = shift((d) => d.setDate(d.getDate() - 1));
      return { from: y, to: y };
    }
    case 'last7':
      return { from: shift((d) => d.setDate(d.getDate() - 6)), to: t };
    case 'last30':
      return { from: shift((d) => d.setDate(d.getDate() - 29)), to: t };
    case 'thisMonth':
      return { from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: t };
    case 'last6m':
      return { from: shift((d) => d.setMonth(d.getMonth() - 6)), to: t };
    case 'thisYear':
      return { from: isoDate(new Date(today.getFullYear(), 0, 1)), to: t };
    case 'lastYear':
      return { from: shift((d) => d.setFullYear(d.getFullYear() - 1)), to: t };
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
