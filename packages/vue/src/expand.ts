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
   * atau `link` (tombol tautan).
   */
  type?: 'text' | 'image' | 'button' | 'link';
  /** Untuk `button`/`link`: URL tujuan. Default nilai field. */
  href?: (row: any) => string;
  linkLabel?: string;
  icon?: IconName;
  newTab?: boolean;
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
