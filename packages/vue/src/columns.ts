import type { VNodeChild } from 'vue';
import { getPath } from '@mrcatz/datatable-core';

export type Align = 'left' | 'center' | 'right';
/** Di mana kolom ditampilkan: tabel desktop, kartu mobile, atau keduanya. */
export type ShowOn = 'both' | 'desktop' | 'mobile';
export type Tone = 'neutral' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error' | 'ghost';

/** Kelas literal (bukan string dinamis) agar terdeteksi pemindai Tailwind. */
export const TONE_BTN: Record<Tone, string> = {
  neutral: 'btn-neutral', primary: 'btn-primary', secondary: 'btn-secondary', accent: 'btn-accent',
  info: 'btn-info', success: 'btn-success', warning: 'btn-warning', error: 'btn-error', ghost: 'btn-ghost',
};

export interface CellContext {
  /** Nomor urut global (sudah memperhitungkan halaman). */
  number: number;
  /** Indeks baris di halaman saat ini. */
  index: number;
  /** Kata kunci pencarian aktif — untuk highlight di render kustom. */
  search: string;
}

export interface InlineEditConfig<T> {
  input?: 'text' | 'number' | 'textarea' | 'select' | 'date';
  options?: Array<{ value: string | number; label: string }>;
  /** Kembalikan pesan error, atau `undefined`/`true` bila valid. */
  validate?: (value: string, row: T) => string | true | undefined;
  /** Izinkan edit per baris (pengganti `enableEditable` callback). */
  when?: (row: T) => boolean;
}

export interface RowAction<T> {
  id: string;
  label: string;
  icon?: import('./icons').IconName;
  tone?: Tone;
  when?: (row: T) => boolean;
  onClick: (row: T) => void;
}

export interface ActionsConfig<T> {
  /** Tampilkan tombol edit; fungsi untuk per baris. Default `true`. */
  edit?: boolean | ((row: T) => boolean);
  /** Tampilkan tombol hapus; fungsi untuk per baris. Default `true`. */
  delete?: boolean | ((row: T) => boolean);
  /** Tombol tambahan (detail, cetak, dll). */
  extra?: RowAction<T>[];
}

export interface ImageConfig {
  width?: number;
  height?: number;
  /** Kelas bentuk gambar, default `rounded-full`. */
  class?: string;
  /** Kolom teks untuk inisial bila gambar kosong. */
  fallbackKey?: string;
  /** Prefix URL untuk path relatif. Default dari plugin (`imageBaseUrl`). */
  baseUrl?: string;
}

export interface ColumnDef<T = any> {
  /** Id unik kolom — dipakai untuk visibilitas/urutan/lebar & slot `#cell-{id}`. */
  id: string;
  kind: 'data' | 'custom' | 'rowNumber' | 'actions' | 'image';
  label: string;
  /** Path data (`nama`, `kategori.nama`). */
  key?: string;
  /** Kunci yang dikirim ke server saat sort. Default = `key`. */
  sortKey?: string;
  sortable: boolean;
  align: Align;
  showOn: ShowOn;
  /** Tersembunyi secara bawaan; pengguna bisa memunculkannya lewat menu Kolom. */
  hidden: boolean;
  /** Tidak bisa disembunyikan pengguna (mis. kolom aksi). */
  pinned?: boolean;
  uppercase?: boolean;
  /** Render sebagai `<th scope="row">` (judul baris, tebal). */
  rowHeader?: boolean;
  /** Sorot kata kunci pencarian. Default true untuk kolom teks. */
  highlight?: boolean;
  width?: number;
  class?: string;
  /** Ubah nilai menjadi teks tampilan (tetap di-highlight). */
  format?: (value: unknown, row: T) => string;
  /** Render kustom (alternatif slot `#cell-{id}`). */
  render?: (row: T, ctx: CellContext) => VNodeChild;
  editable?: InlineEditConfig<T> | false;
  /** Badge berwarna per nilai. */
  badge?: Record<string, Tone> | ((value: unknown, row: T) => Tone);
  /** Gaya badge: `soft` (default), `solid`, atau `outline`. */
  badgeVariant?: 'soft' | 'solid' | 'outline';
  image?: ImageConfig;
  actions?: ActionsConfig<T>;
  /** Ikut diekspor. Default true kecuali kolom aksi. */
  exportable?: boolean;
  /** Nilai yang ditulis ke file export. Default: hasil `format` atau nilai mentah. */
  exportValue?: (row: T) => unknown;
}

type Common<T> = Partial<
  Pick<
    ColumnDef<T>,
    | 'id'
    | 'sortKey'
    | 'align'
    | 'showOn'
    | 'hidden'
    | 'pinned'
    | 'uppercase'
    | 'rowHeader'
    | 'highlight'
    | 'width'
    | 'class'
    | 'format'
    | 'exportable'
    | 'exportValue'
    | 'badgeVariant'
  >
> & { sortable?: boolean };

export interface TextColumnOptions<T> extends Common<T> {
  /** `true` untuk input teks, atau konfigurasi lengkap. */
  editable?: boolean | InlineEditConfig<T>;
}

function base<T>(kind: ColumnDef['kind'], label: string, key: string | undefined, opts: Common<T>): ColumnDef<T> {
  return {
    id: opts.id ?? key ?? `${kind}:${label}`,
    kind,
    label,
    key,
    sortable: opts.sortable ?? !!key,
    align: 'left',
    showOn: 'both',
    hidden: false,
    highlight: kind === 'data',
    ...opts,
  };
}

/**
 * Pembuat definisi kolom (pengganti `withColumn`, `withCustomColumn`, dst.).
 *
 * @example
 * const columns = [
 *   col.rowNumber(),
 *   col.text('nama', 'Nama', { rowHeader: true, editable: true }),
 *   col.badge('status', 'Status', { aktif: 'success', nonaktif: 'ghost' }),
 *   col.date('createdAt', 'Dibuat'),
 *   col.actions(),
 * ];
 */
export const col = {
  /** Kolom teks dari data (pengganti `withColumn`). */
  text<T = any>(key: string, label: string, opts: TextColumnOptions<T> = {}): ColumnDef<T> {
    const { editable, ...rest } = opts;
    return {
      ...base<T>('data', label, key, rest),
      editable: editable === true ? { input: 'text' } : editable || false,
    };
  },

  /** Kolom angka rata kanan dengan format lokal. */
  number<T = any>(
    key: string,
    label: string,
    opts: TextColumnOptions<T> & { intl?: Intl.NumberFormatOptions; locale?: string } = {},
  ): ColumnDef<T> {
    const { intl, locale, ...rest } = opts;
    const fmt = new Intl.NumberFormat(locale ?? 'id-ID', intl);
    return col.text<T>(key, label, {
      align: 'right',
      format: (v) => (v === null || v === undefined || v === '' ? '' : fmt.format(Number(v))),
      ...rest,
      editable: rest.editable === true ? { input: 'number' } : rest.editable,
    });
  },

  /** Kolom tanggal dengan `Intl.DateTimeFormat`. */
  date<T = any>(
    key: string,
    label: string,
    opts: Common<T> & { intl?: Intl.DateTimeFormatOptions; locale?: string } = {},
  ): ColumnDef<T> {
    const { intl, locale, ...rest } = opts;
    const fmt = new Intl.DateTimeFormat(locale ?? 'id-ID', intl ?? { dateStyle: 'medium' });
    return {
      ...base<T>('data', label, key, {
        format: (v) => {
          if (!v) return '';
          const d = new Date(v as string);
          return Number.isNaN(d.getTime()) ? String(v) : fmt.format(d);
        },
        ...rest,
      }),
      editable: false,
    };
  },

  /** Badge berwarna berdasarkan nilai (status, peran, dsb). */
  badge<T = any>(
    key: string,
    label: string,
    tones: Record<string, Tone> | ((value: unknown, row: T) => Tone),
    opts: Common<T> = {},
  ): ColumnDef<T> {
    return { ...base<T>('data', label, key, opts), badge: tones, editable: false };
  },

  /** Kolom kustom — isi lewat `render` atau slot `#cell-{id}` (pengganti `withCustomColumn`). */
  custom<T = any>(
    label: string,
    render?: ((row: T, ctx: CellContext) => VNodeChild) | null,
    opts: Common<T> & { key?: string } = {},
  ): ColumnDef<T> {
    const { key, ...rest } = opts;
    return { ...base<T>('custom', label, key, { sortable: false, ...rest }), render: render ?? undefined };
  },

  /** Nomor urut baris, berlanjut antar halaman (pengganti `withColumnIndex`). */
  rowNumber<T = any>(label = 'No', opts: Common<T> = {}): ColumnDef<T> {
    return { ...base<T>('rowNumber', label, undefined, { id: '__no', sortable: false, width: 56, exportable: true, ...opts }) };
  },

  /** Gambar dengan pratinjau & lightbox (pengganti `withColumnImage`). */
  image<T = any>(key: string, label: string, opts: Common<T> & ImageConfig = {}): ColumnDef<T> {
    const { width, height, class: cls, fallbackKey, baseUrl, ...rest } = opts;
    return {
      ...base<T>('image', label, key, { sortable: false, align: 'center', highlight: false, ...rest }),
      image: { width: width ?? 40, height: height ?? 40, class: cls ?? 'rounded-full', fallbackKey, baseUrl },
    };
  },

  /** Tombol edit/hapus (+ aksi tambahan) per baris (pengganti `withActionColumn`). */
  actions<T = any>(opts: ActionsConfig<T> & { label?: string; align?: Align } = {}): ColumnDef<T> {
    const { label, align, ...actions } = opts;
    return {
      ...base<T>('actions', label ?? '', undefined, {
        id: '__actions',
        sortable: false,
        pinned: true,
        exportable: false,
        align: align ?? 'center',
      }),
      actions: { edit: true, delete: true, ...actions },
    };
  },
};

export function cellValue<T>(column: ColumnDef<T>, row: T): unknown {
  return column.key ? getPath(row, column.key) : undefined;
}

export function displayValue<T>(column: ColumnDef<T>, row: T): string {
  const raw = cellValue(column, row);
  if (column.format) return column.format(raw, row);
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'boolean') return raw ? '✓' : '✗';
  return String(raw);
}

export function resolveImageUrl(value: unknown, baseUrl: string): string | null {
  if (!value || typeof value !== 'string') return null;
  if (/^(https?:)?\/\//.test(value) || value.startsWith('/') || value.startsWith('data:') || value.startsWith('blob:')) return value;
  return baseUrl ? `${baseUrl.replace(/\/$/, '')}/${value}` : value;
}

export function allowed<T>(rule: boolean | ((row: T) => boolean) | undefined, row: T, fallback = true): boolean {
  if (rule === undefined) return fallback;
  return typeof rule === 'function' ? rule(row) : rule;
}
