import type { CompareOperator, DateFormat } from './types';

/**
 * Konversi nilai filter tanggal menjadi rentang waktu setengah-terbuka
 * `[start, end)` agar bisa dipakai oleh database mana pun tanpa fungsi SQL
 * khusus (pengganti whereDate/whereMonth/whereYear di Laravel).
 *
 *   'date'     → '2026-10-19'           → satu hari penuh
 *   'month'    → '2026-10'              → satu bulan penuh
 *   'year'     → '2026'                 → satu tahun penuh
 *   'datetime' → '2026-10-19T08:30'     → satu menit penuh
 *   'time'     → '08:30:15'             → satu detik (atau satu menit bila tanpa detik)
 *   'timeHm'   → '08:30'                → satu menit penuh
 *
 * Format jam (`time` / `timeHm`) tidak terikat tanggal: periodenya berada di
 * 1970-01-01 UTC — sama dengan cara Prisma merepresentasikan kolom `@db.Time`,
 * sehingga hasilnya bisa langsung dipakai di `where` untuk kolom jam.
 */

export interface Period {
  start: Date;
  end: Date;
}

export class InvalidDateValueError extends Error {
  override name = 'InvalidDateValueError';
}

/**
 * Offset zona waktu: `'+08:00'` (WITA), `'+07:00'` (WIB), `'Z'`, atau
 * `undefined` = zona waktu lokal proses (server/browser).
 */
export type UtcOffset = string | undefined;

function offsetMinutes(offset: string): number {
  if (offset === 'Z' || offset === '+00:00') return 0;
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(offset);
  if (!m) throw new InvalidDateValueError(`Offset zona waktu tidak valid: "${offset}"`);
  const minutes = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === '-' ? -minutes : minutes;
}

function makeDate(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  offset: UtcOffset,
): Date {
  if (offset === undefined) return new Date(y, mo, d, h, mi);
  return new Date(Date.UTC(y, mo, d, h, mi) - offsetMinutes(offset) * 60_000);
}

/** `true` untuk format jam dalam sehari (`time` / `timeHm`). */
export function isTimeFormat(format: DateFormat | undefined): format is 'time' | 'timeHm' {
  return format === 'time' || format === 'timeHm';
}

const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Ubah `'HH:mm'` / `'HH:mm:ss'` menjadi jumlah detik sejak tengah malam.
 * Berguna untuk `where` kustom pada filter jam.
 *
 * @example parseTimeOfDay('14:30') // 52200
 */
export function parseTimeOfDay(value: string): number {
  const m = TIME_RE.exec(value.trim());
  const [h, mi, se] = m ? [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)] : [NaN, NaN, NaN];
  if (!m || h > 23 || mi > 59 || se > 59) {
    throw new InvalidDateValueError(`Nilai "${value}" bukan jam yang valid (HH:mm atau HH:mm:ss).`);
  }
  return h * 3600 + mi * 60 + se;
}

/**
 * Jam dalam sehari dari sebuah tanggal (di zona `offset`), dalam bentuk Date
 * 1970-01-01 UTC agar bisa dibandingkan dengan periode format jam.
 */
export function timeOfDay(date: Date, offset?: UtcOffset): Date {
  const seconds =
    offset === undefined
      ? date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()
      : (() => {
          const shifted = new Date(date.getTime() + offsetMinutes(offset) * 60_000);
          return shifted.getUTCHours() * 3600 + shifted.getUTCMinutes() * 60 + shifted.getUTCSeconds();
        })();
  return new Date(seconds * 1000 + date.getMilliseconds());
}

function timePeriod(value: string, format: 'time' | 'timeHm'): Period {
  const seconds = parseTimeOfDay(value);
  // `timeHm` selalu satu menit; `time` tanpa detik juga dianggap satu menit.
  const perMinute = format === 'timeHm' || !/:\d{2}:\d{2}$/.test(value.trim());
  const start = perMinute ? seconds - (seconds % 60) : seconds;
  return { start: new Date(start * 1000), end: new Date((start + (perMinute ? 60 : 1)) * 1000) };
}

export function periodOf(value: string, format: DateFormat, offset?: UtcOffset): Period {
  const v = value.trim();
  let m: RegExpExecArray | null;

  switch (format) {
    case 'time':
    case 'timeHm':
      return timePeriod(v, format);
    case 'year':
      if ((m = /^(\d{4})$/.exec(v))) {
        const y = Number(m[1]);
        return { start: makeDate(y, 0, 1, 0, 0, offset), end: makeDate(y + 1, 0, 1, 0, 0, offset) };
      }
      break;
    case 'month':
      if ((m = /^(\d{4})-(\d{2})$/.exec(v))) {
        const y = Number(m[1]);
        const mo = Number(m[2]) - 1;
        if (mo >= 0 && mo < 12)
          return { start: makeDate(y, mo, 1, 0, 0, offset), end: makeDate(y, mo + 1, 1, 0, 0, offset) };
      }
      break;
    case 'date':
      if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v))) {
        const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
        return { start: makeDate(y, mo, d, 0, 0, offset), end: makeDate(y, mo, d + 1, 0, 0, offset) };
      }
      break;
    case 'datetime':
      if ((m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(v))) {
        const [y, mo, d, h, mi] = [1, 2, 3, 4, 5].map((i) => Number(m![i])) as [
          number,
          number,
          number,
          number,
          number,
        ];
        return {
          start: makeDate(y, mo - 1, d, h, mi, offset),
          end: makeDate(y, mo - 1, d, h, mi + 1, offset),
        };
      }
      break;
  }
  throw new InvalidDateValueError(`Nilai "${value}" tidak sesuai format tanggal "${format}".`);
}

/**
 * Batas perbandingan dalam bentuk netral. `not` berarti di luar periode.
 * Engine menerjemahkan ini ke `where` Prisma, sumber in-memory ke predikat.
 */
export type DateBounds = { gte?: Date; lt?: Date } | { not: Period };

export function compareBounds(period: Period, op: CompareOperator): DateBounds {
  switch (op) {
    case '=':
      return { gte: period.start, lt: period.end };
    case '!=':
      return { not: period };
    case '>':
      return { gte: period.end };
    case '>=':
      return { gte: period.start };
    case '<':
      return { lt: period.start };
    case '<=':
      return { lt: period.end };
  }
}

export function rangeBounds(
  from: string | null,
  to: string | null,
  format: DateFormat,
  offset?: UtcOffset,
): { gte?: Date; lt?: Date } {
  const out: { gte?: Date; lt?: Date } = {};
  if (from) out.gte = periodOf(from, format, offset).start;
  if (to) out.lt = periodOf(to, format, offset).end;
  return out;
}

export function inBounds(date: Date, bounds: DateBounds): boolean {
  const t = date.getTime();
  if ('not' in bounds) return t < bounds.not.start.getTime() || t >= bounds.not.end.getTime();
  if (bounds.gte && t < bounds.gte.getTime()) return false;
  if (bounds.lt && t >= bounds.lt.getTime()) return false;
  return true;
}
