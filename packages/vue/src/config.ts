import { inject, reactive, type InjectionKey } from 'vue';
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
}

export interface Toast {
  id: number;
  type: NotifyType;
  message: string;
}

/** Antrean toast bawaan — dirender oleh `<MrcToaster>`. */
export const toastStore = reactive({ items: [] as Toast[] });
let toastSeq = 0;

export function pushToast(type: NotifyType, message: string, timeout = 4000) {
  const item = { id: ++toastSeq, type, message };
  toastStore.items.push(item);
  setTimeout(() => {
    const i = toastStore.items.findIndex((t) => t.id === item.id);
    if (i >= 0) toastStore.items.splice(i, 1);
  }, timeout);
}

export interface MrcatzContext {
  messages: Messages;
  t: (key: MessageKey, params?: Record<string, unknown>) => string;
  notify: NotifyFn;
  imageBaseUrl: string;
  dateLocale: string;
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
  };
}

const fallback = createContext();

/** Akses konfigurasi; aman dipakai tanpa plugin (memakai default Bahasa Indonesia). */
export function useMrcatz(): MrcatzContext {
  return inject(MRCATZ_KEY, fallback);
}
