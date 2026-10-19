import type { IconName } from './icons';
import type { Tone } from './columns';

export type FormValues = Record<string, any>;
export type CrudMode = 'create' | 'edit';
export type Condition = boolean | ((values: FormValues) => boolean);

export type FieldType =
  | 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search'
  | 'textarea' | 'select' | 'radio' | 'checkbox' | 'toggle' | 'tags'
  | 'date' | 'time' | 'datetime' | 'month' | 'year' | 'color' | 'range' | 'file' | 'hidden'
  | 'section' | 'note' | 'alert' | 'divider' | 'slot' | 'button' | 'image';

export type HintTone = 'success' | 'error' | 'warning' | 'info';

/** Konteks untuk handler tombol & gambar: baca/ubah nilai dan error form. */
export interface FieldActionContext {
  values: FormValues;
  set: (name: string, value: unknown) => void;
  setError: (name: string, message: string) => void;
  clearError: (name: string) => void;
}

export interface FieldOption {
  value: string | number | boolean;
  label: string;
}

export interface FieldDef {
  type: FieldType;
  /** Nama nilai di objek form (kosong untuk elemen statis). */
  name?: string;
  label?: string;
  placeholder?: string;
  /** Teks bantuan di bawah input. */
  hint?: string | null;
  /** Warna hint (mis. `success` untuk "✓ Username tersedia"). Default abu-abu. */
  hintTone?: HintTone;
  icon?: IconName;
  prefix?: string;
  suffix?: string;
  required?: Condition;
  disabled?: Condition;
  /** Sembunyikan (pengganti `hideWhen`). */
  hidden?: Condition;
  /** Tampilkan hanya bila kondisi terpenuhi (pengganti `visibleWhen`/`visibleWhenAll`). */
  visibleWhen?: Record<string, unknown> | ((values: FormValues) => boolean);
  /** Lebar kolom dari 12 (grid). Default 12. */
  span?: number;
  /** Jumlah baris grid yang ditempati (mis. foto di samping beberapa input). */
  rowSpan?: number;
  /** Urutan di layar kecil (CSS `order`), mis. `-1` agar foto tampil paling atas. */
  mobileOrder?: number;
  /** Validasi kustom: kembalikan pesan error, atau `true`/`undefined` bila valid. */
  validate?: (value: any, values: FormValues) => string | true | undefined | Promise<string | true | undefined>;
  defaultValue?: unknown;
  /** Dipanggil saat nilai berubah — mis. mengosongkan field turunan (pengganti `onChange`). */
  onChange?: (value: any, values: FormValues) => void;

  // spesifik tipe
  options?: FieldOption[] | ((values: FormValues) => FieldOption[] | Promise<FieldOption[]>);
  /** Field induk: opsi fungsi dimuat ulang saat nilainya berubah (pengganti `dependsOn`). */
  dependsOn?: string[];
  min?: number | string;
  max?: number | string;
  step?: number;
  minLength?: number;
  maxLength?: number;
  rows?: number;
  accept?: string;
  multiple?: boolean;
  /** Password: tambahkan field konfirmasi `{name}_confirmation` (pengganti `withConfirmation`). */
  confirm?: boolean | string;
  /** Password: tombol tampil/sembunyi & buat acak. Default true. */
  reveal?: boolean;
  generate?: boolean;
  /** section/note/alert/divider */
  text?: string;
  tone?: Tone;
  /** Section: mulai kartu baru berjudul (pengganti `->asCard()`). */
  card?: boolean;

  /** Tombol: aksi saat diklik; spinner tampil selama Promise berjalan (pengganti `onClick` + `withLoading`). */
  onClick?: (ctx: FieldActionContext) => unknown;

  /** Gambar: URL pratinjau saat ini. */
  preview?: string | null;
  previewSize?: number;
  previewClass?: string;
  /** Gambar: teks untuk inisial bila belum ada foto. */
  fallback?: string;
  /** Gambar: unggah berkas terpilih (pengganti `onUpload`). */
  onUpload?: (file: File, ctx: FieldActionContext) => unknown;
  /** Gambar: hapus foto (pengganti `onDelete`). */
  onDelete?: (ctx: FieldActionContext) => unknown;
  /** Gambar: teks konfirmasi sebelum menghapus. */
  deleteConfirm?: string;
  /** Gambar/berkas: ukuran maksimum dalam byte. */
  maxSize?: number;
}

type Opts = Omit<FieldDef, 'type' | 'name' | 'label'>;

const make =
  (type: FieldType) =>
  (name: string, label?: string, opts: Opts = {}): FieldDef => ({ type, name, label, ...opts });

/**
 * Pembuat field form (pengganti `MrCatzFormField::*`). Modifier yang dulu
 * berantai (`->span(6)->hint('...')`) kini menjadi properti objek.
 *
 * @example
 * const fields = [
 *   field.section('Data Diri'),
 *   field.text('nama', 'Nama Lengkap', { required: true, span: 6, icon: 'pencil' }),
 *   field.email('email', 'Email', { required: true, span: 6 }),
 *   field.select('role', 'Peran', { options: ROLES, required: true }),
 *   field.password('password', 'Password', { required: (v) => !v.id, confirm: true, minLength: 8 }),
 *   field.toggle('aktif', 'Aktif', { defaultValue: true }),
 * ];
 */
export const field = {
  text: make('text'),
  email: make('email'),
  password: make('password'),
  number: make('number'),
  tel: make('tel'),
  url: make('url'),
  search: make('search'),
  textarea: make('textarea'),
  select: make('select'),
  radio: make('radio'),
  checkbox: make('checkbox'),
  toggle: make('toggle'),
  tags: make('tags'),
  date: make('date'),
  time: make('time'),
  datetime: make('datetime'),
  month: make('month'),
  year: make('year'),
  color: make('color'),
  range: make('range'),
  file: make('file'),
  hidden: (name: string, defaultValue?: unknown): FieldDef => ({ type: 'hidden', name, defaultValue }),
  /** Area bebas lewat slot `#field-{name}`. */
  slot: make('slot'),

  /** Tombol aksi (mis. cek ketersediaan username). Label boleh kosong untuk tombol ikon. */
  button: (label: string, opts: Opts = {}): FieldDef => ({ type: 'button', label, tone: 'primary', ...opts }),
  /** Foto dengan pratinjau, unggah, dan hapus (mis. avatar). */
  image: (name: string, label?: string, opts: Opts = {}): FieldDef => ({
    type: 'image',
    name,
    label,
    accept: 'image/png,image/jpeg,image/webp',
    ...opts,
  }),

  /** Judul bagian; `{ card: true }` memulai kartu baru (pengganti `->asCard()`). */
  section: (title: string, opts: string | { text?: string; card?: boolean } = {}): FieldDef => ({
    type: 'section',
    label: title,
    ...(typeof opts === 'string' ? { text: opts } : opts),
  }),
  note: (text: string): FieldDef => ({ type: 'note', text }),
  alert: (text: string, tone: Tone = 'info'): FieldDef => ({ type: 'alert', text, tone }),
  divider: (text?: string): FieldDef => ({ type: 'divider', text }),
};

/** Tipe yang tidak menyimpan nilai di objek form. */
export const STATIC_FIELDS: FieldType[] = ['section', 'note', 'alert', 'divider', 'button', 'image'];

export function isInput(f: FieldDef): f is FieldDef & { name: string } {
  return !!f.name && !STATIC_FIELDS.includes(f.type);
}

export function evalCondition(c: Condition | undefined, values: FormValues, fallback = false): boolean {
  if (c === undefined) return fallback;
  return typeof c === 'function' ? c(values) : c;
}

export function isVisible(f: FieldDef, values: FormValues): boolean {
  if (evalCondition(f.hidden, values)) return false;
  const vw = f.visibleWhen;
  if (!vw) return true;
  if (typeof vw === 'function') return vw(values);
  return Object.entries(vw).every(([k, expected]) =>
    Array.isArray(expected) ? expected.includes(values[k]) : values[k] === expected,
  );
}

/** Nilai awal form dari definisi field (+ nilai yang sudah ada, mis. saat edit). */
export function initialValues(fields: FieldDef[], current: FormValues = {}): FormValues {
  const out: FormValues = {};
  for (const f of fields) {
    if (!isInput(f)) continue;
    const empty = f.type === 'checkbox' || f.type === 'toggle' ? false : f.type === 'tags' || (f.type === 'select' && f.multiple) ? [] : '';
    out[f.name] = current[f.name] !== undefined ? current[f.name] : (f.defaultValue ?? empty);
    if (f.type === 'password' && f.confirm) out[`${f.name}_confirmation`] = '';
  }
  return { ...current, ...out };
}
