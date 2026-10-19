import { markRaw, shallowReactive, type Component } from 'vue';
import type { FieldType } from '../../fields';

/**
 * Renderer field tambahan yang bergantung pada paket opsional (Quill, TinyMCE,
 * Leaflet). Paket inti tidak mengimpor apa pun dari library tersebut supaya
 * bundler aplikasi tidak gagal bila paketnya tidak terpasang; entry
 * `@mrcatz/datatable-vue/editor`, `/editor-advanced`, dan `/map` mendaftarkan
 * komponennya sendiri saat diimpor.
 *
 * Kontrak komponen: prop `field`, `modelValue`, `disabled`, `invalid`,
 * dan emit `update:modelValue`.
 */
const renderers = shallowReactive<Partial<Record<FieldType, Component>>>({});

/** Daftarkan komponen untuk sebuah tipe field (mis. editor buatan sendiri). */
export function registerFieldType(type: FieldType, component: Component): void {
  renderers[type] = markRaw(component);
}

export function fieldRenderer(type: FieldType): Component | undefined {
  return renderers[type];
}

/** Sisipkan CSS sekali ke `<head>` (pengganti `<style>` inline di partial Blade). */
export function injectStyle(id: string, css: string): void {
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const el = document.createElement('style');
  el.id = id;
  el.textContent = css;
  document.head.appendChild(el);
}

/** Baca berkas menjadi data URL (mode `base64` versi Laravel). */
export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Tema gelap aktif? Sama dengan pengecekan `data-theme*="dark"` di Laravel. */
export function isDarkTheme(): boolean {
  if (typeof document === 'undefined') return false;
  return !!document.documentElement.getAttribute('data-theme')?.includes('dark');
}

export function cssSize(v: string | number | undefined, fallback: string): string {
  if (v === undefined || v === '') return fallback;
  return typeof v === 'number' ? `${v}px` : v;
}
