import type { Component } from 'vue';
import type { IconName } from './icons';
import type { Tone } from './columns';

export type FormValues = Record<string, any>;
export type CrudMode = 'create' | 'edit';
export type Condition = boolean | ((values: FormValues) => boolean);

export type FieldType =
  | 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search'
  | 'textarea' | 'select' | 'radio' | 'checkbox' | 'toggle' | 'tags'
  | 'date' | 'time' | 'datetime' | 'month' | 'year' | 'color' | 'range' | 'file' | 'hidden'
  | 'section' | 'note' | 'alert' | 'divider' | 'slot' | 'button' | 'image'
  | 'dateRange' | 'rating' | 'chooser' | 'html' | 'fileUpload' | 'editor' | 'editorAdvanced' | 'map';

/** Ukuran daisyUI untuk input (pengganti `->size()`). */
export type FieldSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Aturan bawaan yang pesannya bisa diganti lewat `messages` (pengganti `$messages`). */
export type ValidationRule =
  | 'required' | 'email' | 'url' | 'min' | 'max' | 'minLength' | 'maxLength'
  | 'confirm' | 'maxSize' | 'dateRange' | 'location';

/** Nilai `field.dateRange()`. */
export interface DateRangeValue {
  from: string | null;
  to: string | null;
}

/** Nilai `field.map()`; `radius` hanya ada bila opsi `radius` aktif. */
export interface LatLngValue {
  lat: number | null;
  lng: number | null;
  radius?: number | null;
}

/** Opsi radius `field.map()` (pengganti `showRadius` / `defaultRadius` / `minRadius` / `maxRadius`). */
export interface MapRadiusOptions {
  default?: number;
  min?: number;
  max?: number;
}

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

  /** Gambar/berkas: URL pratinjau saat ini (berkas: tautan + badge ekstensi, atau thumbnail bila gambar). */
  preview?: string | null;
  /** Gambar: ukuran pratinjau persegi (singkatan `previewWidth` + `previewHeight`). */
  previewSize?: number;
  previewClass?: string;
  /** Gambar: teks untuk inisial bila belum ada foto. */
  fallback?: string;
  /**
   * Gambar/berkas: unggah berkas terpilih (pengganti `onUpload`). Pada `file`/`fileUpload`
   * dipanggil langsung saat berkas dipilih; nilai kembalian selain `undefined` (mis. URL)
   * menjadi nilai field.
   */
  onUpload?: (file: File, ctx: FieldActionContext) => unknown;
  /** Gambar/berkas: hapus berkas (pengganti `onDelete`); tombol hapus tampil bila ada pratinjau. */
  onDelete?: (ctx: FieldActionContext) => unknown;
  /** Gambar/berkas: teks konfirmasi sebelum menghapus. */
  deleteConfirm?: string;
  /** Gambar/berkas: ukuran maksimum dalam byte. */
  maxSize?: number;
  /** Gambar/berkas: lebar & tinggi pratinjau (px) — pengganti `->preview($url, $w, $h)`. */
  previewWidth?: number;
  previewHeight?: number;

  /** Ukuran input daisyUI (`input-sm`, `select-lg`, ...) — pengganti `->size()`. Warna memakai `tone` (pengganti `->style()`). */
  size?: FieldSize;
  /** Kelas tambahan pembungkus grid, mis. `'mt-4 px-2'` (pengganti `->margin()` / `->padding()`). */
  class?: string;
  /** Tunda `onChange` (ms) — mis. untuk cek ke server saat mengetik (pengganti `->debounce()`). */
  onChangeDebounce?: number;
  /** Ganti pesan validasi bawaan per aturan (pengganti `$messages`). Mendukung `{label}`, `{min}`, `{max}`. */
  messages?: Partial<Record<ValidationRule, string>>;
  /** Slot: jangan masukkan ke nilai/payload form (konten statis). */
  static?: boolean;

  /** Rentang tanggal: format input (pengganti `$format`; `month_year` → `month`). */
  format?: 'date' | 'datetime' | 'month' | 'year';
  /** Rentang tanggal: tampilkan shortcut (Hari ini, 7 hari terakhir, ...). Default true untuk format `date`. */
  presets?: boolean;

  /** html: konten HTML mentah atau komponen Vue (pengganti `MrCatzFormField::html()`). */
  content?: string | Component;

  /** Editor: unggah gambar dan kembalikan URL-nya. Tanpa ini gambar disisipkan sebagai base64 (sama dengan mode `base64` Laravel). */
  upload?: (file: File) => Promise<string>;
  /** Editor/peta: tinggi area (CSS atau px). Default editor 250px / editor lanjutan 500px / peta 320px. */
  height?: string | number;
  /** Editor: opsi tambahan yang diteruskan apa adanya ke Quill / `tinymce.init()`. */
  editorOptions?: Record<string, unknown>;

  /** Peta: penyedia peta. Default `leaflet` (OpenStreetMap, tanpa API key). */
  provider?: 'leaflet' | 'google';
  /** Peta: API key Google Maps (wajib untuk `provider: 'google'`). */
  apiKey?: string;
  /** Peta: titik awal bila nilai kosong. Default Jakarta (-6.2088, 106.8456). */
  center?: { lat: number; lng: number };
  /** Peta: level zoom awal. Default 13. */
  zoom?: number;
  /** Peta: aktifkan radius (nilai mendapat `radius` dalam meter). */
  radius?: boolean | MapRadiusOptions;
  /** Peta: paksa tema tile (`light`/`dark`); default mengikuti `data-theme`. Leaflet saja. */
  theme?: 'light' | 'dark';
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
  /** Area bebas lewat slot `#field-{name}`. `{ static: true }` = tidak masuk nilai form. */
  slot: make('slot'),
  /** Berkas dengan pratinjau di atas input (pengganti `MrCatzFormField::fileupload()`). */
  fileUpload: make('fileUpload'),
  /**
   * Rentang tanggal `{ from, to }` dengan popover shortcut (pengganti `MrCatzFormField::dateRange()`).
   * @example field.dateRange('periode', 'Periode', { format: 'date', min: '2020-01-01' })
   */
  dateRange: (name: string, label?: string, opts: Opts = {}): FieldDef => ({ type: 'dateRange', name, label, icon: 'event', ...opts }),
  /** Rating bintang, nilai angka 1..max (pengganti `MrCatzFormField::rating()`). */
  rating: (name: string, label?: string, opts: Opts = {}): FieldDef => ({ type: 'rating', name, label, max: 5, ...opts }),
  /** Pilihan banyak berupa tombol, nilai array (pengganti `MrCatzFormField::chooser()`). */
  chooser: make('chooser'),
  /**
   * Editor teks kaya berbasis Quill (pengganti `MrCatzFormField::editor()`). Butuh paket `quill`
   * dan `import '@mrc4tz/datatable-vue/editor'` sekali di aplikasi.
   */
  editor: make('editor'),
  /**
   * Editor lengkap berbasis TinyMCE (pengganti `MrCatzFormField::editorAdvance()`). Butuh paket
   * `tinymce` dan `import '@mrc4tz/datatable-vue/editor-advanced'` sekali di aplikasi.
   */
  editorAdvanced: make('editorAdvanced'),
  /**
   * Pemilih lokasi `{ lat, lng, radius? }` (pengganti `MrCatzFormField::mapPicker()`). Leaflet butuh
   * paket `leaflet` dan `import '@mrc4tz/datatable-vue/map'` sekali di aplikasi.
   */
  map: (name: string, label?: string, opts: Opts = {}): FieldDef => ({ type: 'map', name, label, ...opts }),

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
  /** HTML mentah / komponen Vue tanpa nilai (pengganti `MrCatzFormField::html()`). Jangan isi dengan input pengguna. */
  html: (content: string | Component, opts: Opts = {}): FieldDef => ({ type: 'html', content, ...opts }),
};

/** Tipe yang tidak menyimpan nilai di objek form. */
export const STATIC_FIELDS: FieldType[] = ['section', 'note', 'alert', 'divider', 'button', 'image', 'html'];

export function isInput(f: FieldDef): f is FieldDef & { name: string } {
  return !!f.name && !STATIC_FIELDS.includes(f.type) && !f.static;
}

/** Radius peta yang sudah dinormalkan, atau `null` bila radius tidak aktif. */
export function mapRadius(f: FieldDef): Required<MapRadiusOptions> | null {
  if (!f.radius) return null;
  const r = f.radius === true ? {} : f.radius;
  return { default: r.default ?? 500, min: r.min ?? 10, max: r.max ?? 10000 };
}

/** Nilai kosong per tipe field. */
export function emptyValue(f: FieldDef): unknown {
  switch (f.type) {
    case 'checkbox':
    case 'toggle':
      return false;
    case 'tags':
    case 'chooser':
      return [];
    case 'select':
      return f.multiple ? [] : '';
    case 'rating':
      return null;
    case 'dateRange':
      return { from: null, to: null };
    case 'map':
      return mapRadius(f) ? { lat: null, lng: null, radius: null } : { lat: null, lng: null };
    default:
      return '';
  }
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
    out[f.name] = current[f.name] !== undefined ? current[f.name] : (f.defaultValue ?? emptyValue(f));
    if (f.type === 'password' && f.confirm) out[`${f.name}_confirmation`] = '';
  }
  return { ...current, ...out };
}
