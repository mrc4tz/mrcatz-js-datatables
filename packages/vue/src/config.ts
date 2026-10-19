import { inject, reactive, type Component, type InjectionKey } from 'vue';
import type { IconSet } from './icons';
import type { ExportColors } from './xlsx';
import { en, id, mergeMessages, translate, type DeepPartial, type MessageKey, type Messages } from './i18n';

export type NotifyType = 'success' | 'error' | 'warning' | 'info';
export type NotifyFn = (type: NotifyType, message: string) => void;

export interface MrcatzOptions {
  /** `'id'` (default) atau `'en'`. */
  locale?: 'id' | 'en';
  /** Timpa sebagian teks UI. */
  messages?: DeepPartial<Messages>;
  /**
   * Penampil notifikasi. Default memakai `<MrcToaster>` bawaan. Di proyek
   * yang sudah punya toast (mis. vue-sonner) cukup oper:
   * `notify: (type, msg) => toast[type](msg)`.
   */
  notify?: NotifyFn;
  /** Prefix URL untuk kolom gambar bernilai path relatif (pengganti `url_prefix`). */
  imageBaseUrl?: string;
  /** Format tanggal bawaan untuk `col.date`. */
  dateLocale?: string;
  /** Pengaturan ikon (pengganti `icon_set` / `custom_icons` / `form_icons` di `config/mrcatz.php`). */
  icons?: IconOptions;
  /** Pengaturan export global (pengganti `export_colors` di `config/mrcatz.php`). */
  export?: { colors?: Partial<ExportColors> };
}

/**
 * Nilai ikon kustom:
 * - isi SVG (`'<path d="..."/>'`, `<circle>`, `<g>`, ...) → dibungkus `<svg>` 24×24 stroke 1.5
 * - HTML lain (`'<i class="bi bi-envelope"></i>'`) → dirender apa adanya
 * - komponen Vue (mis. dari `lucide-vue-next`) → dirender dengan prop `size`
 */
export type CustomIcon = string | Component;

export interface IconOptions {
  /**
   * - `'default'` / `'heroicons'`: SVG inline bawaan (Heroicons outline), tanpa dependensi.
   * - `'material'`: font Material (muat sendiri font-nya, mis. Google Fonts Material Symbols).
   * - `'fontawesome'`: kelas Font Awesome 6 (`<i class="fa-solid ...">`), muat CSS-nya sendiri.
   * - `'custom'`: hanya pakai `custom`, sisanya jatuh ke SVG bawaan.
   */
  set?: IconSet;
  /** Kelas font untuk set `'material'`. Default `'material-symbols-outlined'`. */
  materialClass?: string;
  /** Ikon kustom per nama; selalu diprioritaskan di set mana pun (gabungan `custom_icons` + `form_icons`). */
  custom?: Record<string, CustomIcon>;
}

export interface ResolvedIcons {
  set: IconSet;
  materialClass: string;
  custom: Record<string, CustomIcon>;
}

export interface Toast {
  id: number;
  type: NotifyType;
  message: string;
}

/** Antrean toast bawaan — dirender oleh `<MrcToaster>`. */
export const toastStore = reactive({ items: [] as Toast[] });
let toastSeq = 0;

export function removeToast(id: number) {
  const i = toastStore.items.findIndex((t) => t.id === id);
  if (i >= 0) toastStore.items.splice(i, 1);
}

/** Sama dengan versi Laravel: tampil 2 detik × jumlah toast yang sedang terlihat. */
export function pushToast(type: NotifyType, message: string) {
  const item = { id: ++toastSeq, type, message };
  toastStore.items.push(item);
  setTimeout(() => removeToast(item.id), 2000 * toastStore.items.length);
}

/** Lightbox gambar global — dirender oleh `<MrcToaster>`. */
export const lightboxStore = reactive({ url: null as string | null });
export function openLightbox(url: string) {
  lightboxStore.url = url;
}

export interface MrcatzContext {
  messages: Messages;
  t: (key: MessageKey, params?: Record<string, unknown>) => string;
  /** Bahasa aktif. */
  readonly locale: 'id' | 'en';
  /** Ganti bahasa saat runtime (teks `messages` kustom tetap dipakai). Komponen ikut berubah. */
  setLocale: (locale: 'id' | 'en') => void;
  notify: NotifyFn;
  imageBaseUrl: string;
  dateLocale: string;
  icons: ResolvedIcons;
  exportColors: Partial<ExportColors>;
}

export const MRCATZ_KEY: InjectionKey<MrcatzContext> = Symbol('mrcatz');

export function createContext(opts: MrcatzOptions = {}): MrcatzContext {
  // Reaktif agar `setLocale` langsung memperbarui semua komponen.
  const i18n = reactive({
    locale: opts.locale ?? ('id' as 'id' | 'en'),
    messages: mergeMessages(opts.locale === 'en' ? en : id, opts.messages),
  });
  const ctx: MrcatzContext = {
    get messages() {
      return i18n.messages;
    },
    get locale() {
      return i18n.locale;
    },
    t: (key, params) => translate(i18n.messages, key, params),
    setLocale(locale) {
      i18n.locale = locale;
      i18n.messages = mergeMessages(locale === 'en' ? en : id, opts.messages);
    },
    notify: opts.notify ?? pushToast,
    imageBaseUrl: opts.imageBaseUrl ?? '',
    get dateLocale() {
      return opts.dateLocale ?? (i18n.locale === 'en' ? 'en-US' : 'id-ID');
    },
    icons: {
      set: opts.icons?.set ?? 'default',
      materialClass: opts.icons?.materialClass ?? 'material-symbols-outlined',
      custom: opts.icons?.custom ?? {},
    },
    exportColors: opts.export?.colors ?? {},
  };
  return ctx;
}

const fallback = createContext();

/** Akses konfigurasi; aman dipakai tanpa plugin (memakai default Bahasa Indonesia). */
export function useMrcatz(): MrcatzContext {
  return inject(MRCATZ_KEY, fallback);
}
