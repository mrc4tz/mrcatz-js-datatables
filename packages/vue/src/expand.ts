import type { VNodeChild } from 'vue';
import type { Tone } from './columns';
import type { IconName } from './icons';

/** Satu field di `<MrcExpandFields>` (pengganti array `getExpandView`). */
export interface ExpandField {
  label: string;
  /** Path data; atau pakai `value`. */
  key?: string;
  value?: (row: any) => unknown;
  /**
   * `text` (default), `image`, `button` (tautan unduh/lampiran bergaya link),
   * `link` (tombol tautan), `html` (HTML mentah — pastikan aman dari XSS),
   * atau `custom` (render VNode sendiri lewat `render`).
   */
  type?: 'text' | 'image' | 'button' | 'link' | 'html' | 'custom';
  /** Untuk `html`: string HTML. Default nilai field. */
  html?: (row: any) => string;
  /** Untuk `custom`: isi sel, mis. `(row) => h(MyBadge, { status: row.status })`. */
  render?: (row: any) => VNodeChild;
  /** Untuk `button`/`link`: URL tujuan. Default nilai field. */
  href?: (row: any) => string;
  linkLabel?: string;
  icon?: IconName;
  newTab?: boolean;
  /** Untuk `button`/`link`: atribut `target` bebas (menimpa `newTab`). */
  target?: string;
  /** Untuk `image`: prefix URL path relatif (menimpa `imageBaseUrl`; `''` = apa adanya). Pengganti `urlPrefix`. */
  baseUrl?: string;
  download?: boolean;
  /** Warna tombol `link` (default `ghost`). */
  tone?: Tone;
  /** Untuk `image`: ukuran & bentuk pratinjau. */
  width?: number;
  height?: number;
  previewClass?: string;
  /** Untuk `image`: kolom teks untuk inisial cadangan. */
  fallbackKey?: string;
}
