import { inject, reactive, type Component, type InjectionKey } from 'vue';
import type { IconSet } from './icons';
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
  notify: NotifyFn;
  imageBaseUrl: string;
  dateLocale: string;
  icons: ResolvedIcons;
}

export const MRCATZ_KEY: InjectionKey<MrcatzContext> = Symbol('mrcatz');

export function createContext(opts: MrcatzOptions = {}): MrcatzContext {
  const messages = mergeMessages(opts.locale === 'en' ? en : id, opts.messages);
  return {
    messages,
    t: (key, params) => translate(messages, key, params),
    notify: opts.notify ?? pushToast,
    imageBaseUrl: opts.imageBaseUrl ?? '',
    dateLocale: opts.dateLocale ?? (opts.locale === 'en' ? 'en-US' : 'id-ID'),
    icons: {
      set: opts.icons?.set ?? 'default',
      materialClass: opts.icons?.materialClass ?? 'material-symbols-outlined',
      custom: opts.icons?.custom ?? {},
    },
  };
}

const fallback = createContext();

/** Akses konfigurasi; aman dipakai tanpa plugin (memakai default Bahasa Indonesia). */
export function useMrcatz(): MrcatzContext {
  return inject(MRCATZ_KEY, fallback);
}
