import type { IconName } from './icons';

/** Satu baris label–nilai di `<MrcExpandFields>`. */
export interface ExpandField {
  label: string;
  /** Path data; atau pakai `value`. */
  key?: string;
  value?: (row: any) => unknown;
  type?: 'text' | 'image' | 'link';
  /** Untuk `link`: URL tujuan. */
  href?: (row: any) => string;
  linkLabel?: string;
  icon?: IconName;
  newTab?: boolean;
  download?: boolean;
  span?: 1 | 2 | 3;
}
