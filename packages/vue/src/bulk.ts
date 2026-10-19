import type { Tone } from './columns';
import type { FieldDef } from './fields';
import type { IconName } from './icons';

export interface BulkAction<T = any> {
  id: string;
  label: string;
  /**
   * `confirm` — dialog konfirmasi dulu; `form` — isi form dulu (mis. ubah status
   * massal); `instant` — langsung jalan.
   */
  mode: 'confirm' | 'form' | 'instant';
  title?: string;
  description?: string;
  icon?: IconName;
  tone?: Tone;
  /** Field untuk mode `form`. */
  fields?: FieldDef[];
  /** Aksi hanya tampil bila semua baris terpilih memenuhi syarat. */
  when?: (rows: T[]) => boolean;
  /**
   * Notifikasi sukses setelah aksi berhasil. Default `"<n> data berhasil diupdate!"`.
   * `false` = tanpa notifikasi; string/fungsi = pesan sendiri. Handler `@bulk-action`
   * juga boleh mengembalikan string untuk menimpa pesan.
   */
  notify?: boolean | string | ((count: number) => string);
}

/**
 * Pembuat aksi massal (pengganti `MrCatzBulkAction::create`).
 *
 * @example
 * bulkAction('arsipkan', 'Arsipkan', { mode: 'confirm', icon: 'inbox', tone: 'warning' })
 * bulkAction('ubahStatus', 'Ubah Status', { mode: 'form', fields: [field.select('status', 'Status', { options })] })
 *
 * Field `field.slot('x')` di form aksi massal dirender lewat slot
 * `#bulk-field-<id aksi>-x="{ value, set, disabled }"` pada tabel.
 */
export function bulkAction<T = any>(
  id: string,
  label: string,
  opts: Omit<BulkAction<T>, 'id' | 'label' | 'mode'> & { mode?: BulkAction['mode'] } = {},
): BulkAction<T> {
  return { id, label, mode: opts.fields ? 'form' : 'confirm', tone: 'primary', ...opts };
}
