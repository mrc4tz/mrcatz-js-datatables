<script setup lang="ts">
/**
 * Editor teks kaya berbasis Quill 2 — port `partials/form/editor.blade.php`.
 * `quill` adalah peer dependency opsional yang dimuat lewat `import()` saat
 * field pertama kali tampil. Dokumen kosong (`<p><br></p>`) dinormalkan ke
 * `''` agar aturan `required` bekerja. Gambar: `field.upload(file)` → URL,
 * tanpa itu gambar disisipkan sebagai base64 (default Laravel).
 */
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useMrcatz } from '../../../config';
import type { FieldDef } from '../../../fields';
import { errorMessage } from '../../../validation';
import { cssSize, injectStyle } from '../registry';

const props = defineProps<{ field: FieldDef; modelValue?: unknown; disabled?: boolean; invalid?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const { t, notify } = useMrcatz();

const host = ref<HTMLElement>();
const loading = ref(true);
const failed = ref<string | null>(null);
const quill = shallowRef<any>(null);

/** Toolbar sama persis dengan versi Laravel; ganti lewat `editorOptions.modules.toolbar`. */
const TOOLBAR: unknown[] = [
  [{ header: [2, 3, 4, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote', 'link', 'image'],
  ['clean'],
];

const CSS = `
.mrcatz-editor { position: relative; display: flex; flex-direction: column; }
.mrcatz-editor .ql-toolbar.ql-snow { border-radius: 0.5rem 0.5rem 0 0; border-color: #d1d5db; flex-shrink: 0; }
.mrcatz-editor .ql-container.ql-snow { border-radius: 0 0 0.5rem 0.5rem; border-color: #d1d5db; height: var(--mrc-editor-height, 250px); min-height: 150px; max-height: 80vh; font-size: 0.925rem; resize: vertical; overflow: hidden; }
.mrcatz-editor .ql-editor { height: 100%; overflow-y: auto; }
.mrcatz-editor.mrcatz-editor-error .ql-toolbar.ql-snow, .mrcatz-editor.mrcatz-editor-error .ql-container.ql-snow { border-color: var(--color-error, #ef4444) !important; }
[data-theme*="dark"] .mrcatz-editor .ql-toolbar.ql-snow { border-color: #4b5563; background-color: var(--color-base-200); }
[data-theme*="dark"] .mrcatz-editor .ql-container.ql-snow { border-color: #4b5563; background-color: var(--color-base-100); }
[data-theme*="dark"] .mrcatz-editor .ql-editor { color: var(--color-base-content); }
[data-theme*="dark"] .mrcatz-editor .ql-editor.ql-blank::before { color: color-mix(in oklab, var(--color-base-content) 40%, transparent); }
[data-theme*="dark"] .mrcatz-editor .ql-snow .ql-stroke { stroke: #9ca3af; }
[data-theme*="dark"] .mrcatz-editor .ql-snow .ql-fill { fill: #9ca3af; }
[data-theme*="dark"] .mrcatz-editor .ql-snow .ql-picker, [data-theme*="dark"] .mrcatz-editor .ql-snow .ql-picker-label { color: #9ca3af; }
[data-theme*="dark"] .mrcatz-editor .ql-snow .ql-picker-options { background-color: #1f2937 !important; border-color: #4b5563 !important; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
[data-theme*="dark"] .mrcatz-editor .ql-snow .ql-picker-item { color: #9ca3af; }
[data-theme*="dark"] .mrcatz-editor .ql-snow .ql-picker-item:hover { color: #e5e7eb; background-color: #374151; }
[data-theme*="dark"] .mrcatz-editor .ql-snow button:hover .ql-stroke { stroke: #e5e7eb; }
[data-theme*="dark"] .mrcatz-editor .ql-snow button:hover .ql-fill { fill: #e5e7eb; }
[data-theme*="dark"] .mrcatz-editor .ql-snow .ql-picker-label:hover { color: #e5e7eb; }
[data-theme*="dark"] .mrcatz-editor .ql-snow button.ql-active .ql-stroke { stroke: #60a5fa; }
[data-theme*="dark"] .mrcatz-editor .ql-snow button.ql-active .ql-fill { fill: #60a5fa; }
[data-theme*="dark"] .mrcatz-editor .ql-snow .ql-picker-label.ql-active { color: #60a5fa; }
`;

const normalize = (html: string) => (html === '<p><br></p>' ? '' : html);
const asHtml = (v: unknown) => (typeof v === 'string' ? v : '');

function pickImage() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file || !props.field.upload) return;
    try {
      const url = await props.field.upload(file);
      const q = quill.value;
      const range = q.getSelection(true);
      q.insertEmbed(range.index, 'image', url);
      q.setSelection(range.index + 1);
    } catch (e) {
      notify('error', errorMessage(e, t('form.uploadFailed')));
    }
  };
  input.click();
}

onMounted(async () => {
  injectStyle('mrcatz-editor-style', CSS);
  try {
    const [mod] = await Promise.all([import('quill'), import('quill/dist/quill.snow.css').catch(() => undefined)]);
    const Quill = (mod as { default?: unknown }).default ?? mod;
    if (!host.value) return;
    const opts = props.field.editorOptions ?? {};
    const q = new (Quill as new (el: HTMLElement, o: Record<string, unknown>) => any)(host.value, {
      theme: 'snow',
      placeholder: props.field.placeholder ?? t('form.editorPlaceholder'),
      readOnly: !!props.disabled,
      ...opts,
      modules: { toolbar: TOOLBAR, ...((opts.modules as Record<string, unknown>) ?? {}) },
    });
    quill.value = q;
    // Mode upload: ganti handler gambar bawaan (base64) dengan `field.upload`.
    if (props.field.upload) q.getModule('toolbar')?.addHandler('image', pickImage);
    const initial = asHtml(props.modelValue);
    if (initial) q.root.innerHTML = initial;
    q.on('text-change', () => {
      const html = normalize(q.root.innerHTML);
      if (html !== asHtml(props.modelValue)) emit('update:modelValue', html);
    });
  } catch (e) {
    failed.value = errorMessage(e, 'quill');
    console.warn('[mrcatz] field.editor() butuh paket "quill": bun add quill', e);
  } finally {
    loading.value = false;
  }
});

// Nilai diubah dari luar (reset form, ctx.set) → perbarui isi editor.
watch(
  () => props.modelValue,
  (v) => {
    const q = quill.value;
    if (q && asHtml(v) !== normalize(q.root.innerHTML)) q.root.innerHTML = asHtml(v);
  },
);
watch(
  () => props.disabled,
  (d) => quill.value?.enable(!d),
);
onBeforeUnmount(() => quill.value?.off?.('text-change'));
</script>

<template>
  <div class="mrcatz-editor" :class="invalid && 'mrcatz-editor-error'" :style="{ '--mrc-editor-height': cssSize(field.height, '250px') }">
    <div ref="host" />
    <div v-if="loading" class="skeleton h-40 w-full rounded-lg" />
    <p v-if="failed" class="text-error text-xs">{{ t('form.editorMissing') }}</p>
  </div>
</template>
