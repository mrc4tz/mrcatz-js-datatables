<script setup lang="ts">
/**
 * Editor lengkap berbasis TinyMCE 7 (GPL) — port
 * `partials/form/editor_advance.blade.php`: menubar penuh, tabel, source
 * view, fullscreen, dll. `tinymce` adalah peer dependency opsional yang
 * dimuat lewat `import()` (atau memakai `window.tinymce` bila sudah dimuat
 * dari CDN). Skin, tema, dan plugin dimuat dari `base_url` — default CDN
 * jsDelivr seperti versi Laravel; ganti lewat `editorOptions.base_url` untuk
 * self-host. Editor di-init ulang saat tema terang/gelap berganti.
 */
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useMrcatz } from '../../../config';
import type { FieldDef } from '../../../fields';
import { errorMessage } from '../../../validation';
import { injectStyle, isDarkTheme, readAsDataUrl } from '../registry';

const props = defineProps<{ field: FieldDef; modelValue?: unknown; disabled?: boolean; invalid?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const { t } = useMrcatz();

const textarea = ref<HTMLTextAreaElement>();
const loading = ref(true);
const failed = ref(false);
const editor = shallowRef<any>(null);
let tiny: any = null;
let themeObserver: MutationObserver | null = null;
let disposed = false;

const CDN = 'https://cdn.jsdelivr.net/npm/tinymce@7';

const CSS = `
.mrcatz-editor-adv { position: relative; }
.mrcatz-editor-adv .tox-tinymce { border-radius: 0.5rem; border-width: 1px; border-color: #d1d5db; }
.mrcatz-editor-adv .tox-editor-header { border-bottom: 1px solid #d1d5db !important; box-shadow: none !important; }
.mrcatz-editor-adv .tox-tinymce, .mrcatz-editor-adv .tox-editor-container, .mrcatz-editor-adv .tox-editor-header,
.mrcatz-editor-adv .tox-menubar, .mrcatz-editor-adv .tox-toolbar, .mrcatz-editor-adv .tox-toolbar__primary,
.mrcatz-editor-adv .tox-toolbar-overlord, .mrcatz-editor-adv .tox-edit-area, .mrcatz-editor-adv .tox-edit-area__iframe,
.mrcatz-editor-adv .tox-statusbar { background-color: transparent !important; }
.mrcatz-editor-adv.mrcatz-editor-error .tox-tinymce { border-color: var(--color-error, #ef4444) !important; }
[data-theme*="dark"] .mrcatz-editor-adv .tox-tinymce { border-color: #4b5563; }
[data-theme*="dark"] .mrcatz-editor-adv .tox-editor-header { border-bottom-color: #4b5563 !important; }
[data-theme*="dark"] .mrcatz-editor-adv .tox-editor-header, [data-theme*="dark"] .mrcatz-editor-adv .tox-menubar,
[data-theme*="dark"] .mrcatz-editor-adv .tox-toolbar__primary { background-color: var(--color-base-200) !important; }
[data-theme*="dark"] .mrcatz-editor-adv .tox .tox-tbtn, [data-theme*="dark"] .mrcatz-editor-adv .tox .tox-mbtn { color: #9ca3af !important; }
[data-theme*="dark"] .mrcatz-editor-adv .tox .tox-tbtn svg, [data-theme*="dark"] .mrcatz-editor-adv .tox .tox-mbtn svg,
[data-theme*="dark"] .mrcatz-editor-adv .tox .tox-icon svg { fill: #9ca3af !important; }
[data-theme*="dark"] .mrcatz-editor-adv .tox .tox-tbtn:hover, [data-theme*="dark"] .mrcatz-editor-adv .tox .tox-mbtn:hover { color: #e5e7eb !important; background-color: #374151 !important; }
[data-theme*="dark"] .mrcatz-editor-adv .tox .tox-tbtn:hover svg, [data-theme*="dark"] .mrcatz-editor-adv .tox .tox-mbtn:hover svg { fill: #e5e7eb !important; }
[data-theme*="dark"] .mrcatz-editor-adv .tox .tox-tbtn--enabled, [data-theme*="dark"] .mrcatz-editor-adv .tox .tox-tbtn--enabled:hover { color: #60a5fa !important; background-color: transparent !important; }
[data-theme*="dark"] .mrcatz-editor-adv .tox .tox-tbtn--enabled svg, [data-theme*="dark"] .mrcatz-editor-adv .tox .tox-tbtn--enabled:hover svg { fill: #60a5fa !important; }
[data-theme*="dark"] .mrcatz-editor-adv .tox .tox-tbtn__select-label { color: #9ca3af !important; }
[data-theme*="dark"] .mrcatz-editor-adv .tox .tox-tbtn__select-chevron svg { fill: #9ca3af !important; }
[data-theme*="dark"] .tox .tox-menu, [data-theme*="dark"] .tox .tox-collection--list { background-color: #1f2937 !important; border-color: #4b5563 !important; box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important; }
[data-theme*="dark"] .tox .tox-collection__item { color: #9ca3af !important; }
[data-theme*="dark"] .tox .tox-collection__item--active, [data-theme*="dark"] .tox .tox-collection__item:hover { color: #e5e7eb !important; background-color: #374151 !important; }
[data-theme*="dark"] .tox .tox-collection__item svg { fill: #9ca3af !important; }
[data-theme*="dark"] .mrcatz-editor-adv .tox-toolbar__group { border-color: #4b5563 !important; }
.tox-tinymce-aux, .tox-silver-sink { z-index: 2147483646 !important; }
`;

const asHtml = (v: unknown) => (typeof v === 'string' ? v : '');

/** Gambar dari tombol toolbar: `field.upload` → URL, tanpa itu base64. */
async function imageSrc(file: File): Promise<string> {
  return props.field.upload ? props.field.upload(file) : readAsDataUrl(file);
}

function insertImage(ed: any) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const src = await imageSrc(file);
      ed.insertContent(`<img src=${JSON.stringify(src)} alt=${JSON.stringify(file.name || '')} />`);
    } catch (e) {
      ed.notificationManager?.open({ text: errorMessage(e, t('form.uploadFailed')), type: 'error' });
    }
  };
  input.click();
}

function contentStyle(): string {
  // Iframe tidak mewarisi warna induk — salin warna body host (ikut tema).
  const host = getComputedStyle(document.body);
  const bg = host.backgroundColor || 'transparent';
  const color = host.color || 'inherit';
  return (
    `html, body { background: ${bg} !important; color: ${color} !important; font-family: inherit; font-size: 14px; }` +
    `p, h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, pre, table, td, th { background: transparent !important; color: inherit; }` +
    `body[data-mce-placeholder]:not(.mce-visualblocks)::before { color: ${color} !important; opacity: 0.4; font-style: italic; }`
  );
}

async function init() {
  const el = textarea.value;
  if (!el || !tiny || disposed) return;
  const dark = isDarkTheme();
  const opts = props.field.editorOptions ?? {};
  const base = (opts.base_url as string | undefined) ?? CDN;
  const [ed] = await tiny.init({
    target: el,
    license_key: 'gpl',
    base_url: base,
    suffix: '.min',
    skin_url: `${base}/skins/ui/${dark ? 'oxide-dark' : 'oxide'}`,
    content_css: false,
    ui_container: el.closest('dialog') ?? document.body,
    height: props.field.height ?? 500,
    menubar: 'file edit view insert format tools table help',
    plugins:
      'advlist autolink lists link image charmap preview anchor pagebreak searchreplace wordcount visualblocks visualchars code fullscreen insertdatetime media nonbreaking table emoticons help',
    toolbar:
      'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | forecolor backcolor | subscript superscript | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link mrcatzimage media table | hr charmap emoticons | removeformat searchreplace | code fullscreen preview',
    toolbar_mode: 'sliding',
    placeholder: props.field.placeholder ?? t('form.editorPlaceholder'),
    readonly: !!props.disabled,
    branding: false,
    promotion: false,
    resize: true,
    content_style: contentStyle(),
    paste_data_images: false,
    ...(props.field.upload ? { images_upload_handler: (blob: any) => props.field.upload!(new File([blob.blob()], blob.filename())) } : {}),
    ...opts,
    setup: (e: any) => {
      // Tombol gambar sendiri: langsung buka pemilih berkas tanpa dialog TinyMCE.
      e.ui.registry.addButton('mrcatzimage', { icon: 'image', tooltip: e.translate('Insert image'), onAction: () => insertImage(e) });
      e.on('init', () => {
        const initial = asHtml(props.modelValue);
        if (initial) e.setContent(initial);
      });
      e.on('change keyup undo redo input', () => {
        const html = e.getContent();
        if (html !== asHtml(props.modelValue)) emit('update:modelValue', html);
      });
      (opts.setup as ((e: unknown) => void) | undefined)?.(e);
    },
  });
  editor.value = ed ?? null;
}

onMounted(async () => {
  injectStyle('mrcatz-editor-adv-style', CSS);
  try {
    const w = window as unknown as { tinymce?: unknown };
    if (w.tinymce) tiny = w.tinymce;
    else {
      const mod = await import('tinymce');
      tiny = (mod as { default?: unknown }).default ?? w.tinymce ?? mod;
    }
    await init();
    // TinyMCE tidak bisa ganti skin di tempat: init ulang saat tema berganti (isi tetap dari modelValue).
    themeObserver = new MutationObserver(() => {
      if (!editor.value) return;
      tiny.remove(editor.value);
      editor.value = null;
      void init();
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
  } catch (e) {
    failed.value = true;
    console.warn('[mrcatz] field.editorAdvanced() butuh paket "tinymce": bun add tinymce', e);
  } finally {
    loading.value = false;
  }
});

watch(
  () => props.modelValue,
  (v) => {
    const ed = editor.value;
    if (ed && asHtml(v) !== ed.getContent()) ed.setContent(asHtml(v));
  },
);
watch(
  () => props.disabled,
  (d) => editor.value?.mode?.set(d ? 'readonly' : 'design'),
);
onBeforeUnmount(() => {
  disposed = true;
  themeObserver?.disconnect();
  if (editor.value) tiny?.remove(editor.value);
});
</script>

<template>
  <div class="mrcatz-editor-adv w-full" :class="invalid && 'mrcatz-editor-error'">
    <textarea ref="textarea" class="hidden w-full" />
    <div v-if="loading" class="skeleton h-40 w-full rounded-lg" />
    <p v-if="failed" class="text-error text-xs">{{ t('form.editorMissing') }}</p>
  </div>
</template>
