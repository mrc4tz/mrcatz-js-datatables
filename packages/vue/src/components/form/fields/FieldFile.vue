<script setup lang="ts">
/**
 * Input berkas dengan pratinjau — port `partials/form/file.blade.php`
 * (`field.file`) dan `fileupload.blade.php` (`field.fileUpload`, pratinjau
 * di samping keterangan). Pratinjau memakai `preview` atau nilai field bila
 * berupa URL. `onUpload` mengunggah langsung saat berkas dipilih (nilai
 * kembaliannya, mis. URL, menjadi nilai field); `onDelete` menampilkan tombol
 * hapus dengan konfirmasi.
 */
import { computed, ref } from 'vue';
import { openLightbox, useMrcatz } from '../../../config';
import type { FieldActionContext, FieldDef } from '../../../fields';
import { errorMessage, maxSizeMessage } from '../../../validation';
import MrcConfirm from '../../MrcConfirm.vue';
import MrcIcon from '../../MrcIcon.vue';

const props = defineProps<{
  field: FieldDef;
  modelValue?: unknown;
  disabled?: boolean;
  invalid?: boolean;
  inputClass?: string;
  ctx: FieldActionContext;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>();
const { t } = useMrcatz();

const name = computed(() => props.field.name ?? '');
const url = computed(() => props.field.preview ?? (typeof props.modelValue === 'string' && props.modelValue ? props.modelValue : null));
const ext = computed(() => {
  if (!url.value) return '';
  const path = url.value.split(/[?#]/)[0] ?? '';
  return url.value.startsWith('data:image/') ? 'png' : (path.split('.').pop() ?? '').toLowerCase();
});
const isImage = computed(() => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext.value));
const basename = computed(() => decodeURIComponent((url.value ?? '').split(/[?#]/)[0]!.split('/').pop() ?? ''));
const IMAGE = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
const SHEET = ['xls', 'xlsx', 'csv'];
const DOC = ['doc', 'docx'];
const ARCHIVE = ['zip', 'rar', '7z', 'tar', 'gz'];
const fileIcon = computed(() => {
  const e = ext.value;
  if (IMAGE.includes(e)) return 'image';
  if (e === 'pdf') return 'picture_as_pdf';
  if (SHEET.includes(e)) return 'table_view';
  if (DOC.includes(e)) return 'edit_note';
  if (ARCHIVE.includes(e)) return 'save';
  return 'download';
});
const fileBadge = computed(() => {
  const e = ext.value;
  if (e === 'pdf') return 'badge-error';
  if (SHEET.includes(e)) return 'badge-success';
  if (DOC.includes(e)) return 'badge-info';
  if (ARCHIVE.includes(e)) return 'badge-warning';
  if (IMAGE.includes(e)) return 'badge-primary';
  return 'badge-ghost';
});

const busy = ref(false);
const input = ref<HTMLInputElement>();
const confirmDelete = ref(false);

async function run(fn: () => unknown) {
  busy.value = true;
  try {
    await fn();
  } catch (e) {
    props.ctx.setError(name.value, errorMessage(e, t('form.uploadFailed')));
  } finally {
    busy.value = false;
  }
}

function onPick(e: Event) {
  const files = [...((e.target as HTMLInputElement).files ?? [])];
  const f = props.field;
  props.ctx.clearError(name.value);
  if (f.maxSize && files.some((x) => x.size > f.maxSize!)) {
    props.ctx.setError(name.value, maxSizeMessage(f, t));
    if (input.value) input.value.value = '';
    return;
  }
  if (f.onUpload && files[0]) {
    const file = files[0];
    void run(async () => {
      const res = await f.onUpload!(file, props.ctx);
      if (res !== undefined) emit('update:modelValue', res);
      if (input.value) input.value.value = '';
    });
    return;
  }
  emit('update:modelValue', f.multiple ? files : (files[0] ?? null));
}

function remove() {
  confirmDelete.value = false;
  void run(async () => {
    await props.field.onDelete!(props.ctx);
    if (typeof props.modelValue === 'string') emit('update:modelValue', '');
  });
}

const thumbStyle = computed(() => ({
  width: `${props.field.previewWidth ?? props.field.previewSize ?? 80}px`,
  height: `${props.field.previewHeight ?? props.field.previewSize ?? 80}px`,
}));
</script>

<template>
  <div v-if="url" class="mb-2 flex items-start gap-3">
    <template v-if="isImage">
      <!-- file(): gambar setinggi maks 128px; fileUpload(): thumbnail berukuran tetap + keterangan -->
      <div
        v-if="field.type === 'fileUpload'"
        class="border-base-content/10 shrink-0 cursor-zoom-in overflow-hidden rounded-lg border transition-opacity hover:opacity-80"
        :class="field.previewClass"
        :style="thumbStyle"
        @click="openLightbox(url)"
      >
        <img :src="url" alt="" class="block h-full w-full object-cover object-center" />
      </div>
      <div
        v-else
        class="border-base-content/10 inline-block shrink-0 cursor-zoom-in overflow-hidden rounded-lg border transition-opacity hover:opacity-80"
        :class="field.previewClass"
        :style="field.previewWidth || field.previewHeight ? thumbStyle : { maxHeight: '128px' }"
        @click="openLightbox(url)"
      >
        <img :src="url" alt="Preview" :class="field.previewWidth || field.previewHeight ? 'block h-full w-full object-cover' : 'max-h-32 object-cover'" />
      </div>
      <div v-if="field.type === 'fileUpload'" class="text-base-content/40 mt-1 text-xs">
        <p>{{ t('form.currentFile') }}</p>
        <p class="text-base-content/60">{{ t('form.clickToZoom') }}</p>
      </div>
    </template>
    <a
      v-else
      :href="url"
      target="_blank"
      rel="noopener"
      class="border-base-content/10 bg-base-200/30 hover:bg-base-200/60 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
    >
      <MrcIcon :name="fileIcon" :size="18" />
      <div class="flex flex-col">
        <span class="text-base-content/80 max-w-48 truncate font-medium">{{ basename }}</span>
        <span class="badge badge-xs mt-0.5 uppercase" :class="fileBadge">{{ ext }}</span>
      </div>
    </a>
    <button
      v-if="field.onDelete"
      type="button"
      class="btn btn-error btn-sm btn-outline ml-auto gap-1"
      :disabled="disabled || busy"
      :aria-label="t('action.delete')"
      @click="confirmDelete = true"
    >
      <MrcIcon name="delete" :size="16" />
    </button>
  </div>
  <div class="flex items-center gap-2">
    <input
      ref="input"
      type="file"
      class="file-input file-input-bordered w-full"
      :class="[inputClass, { 'file-input-error': invalid, 'bg-base-200 opacity-60': disabled }]"
      :accept="field.accept"
      :multiple="field.multiple && !field.onUpload"
      :disabled="disabled || busy"
      @change="onPick"
    />
    <span v-if="busy" class="loading loading-spinner loading-sm shrink-0" />
  </div>
  <MrcConfirm
    v-if="field.onDelete"
    v-model:open="confirmDelete"
    variant="large"
    :title="field.deleteConfirm ?? t('form.deleteFile')"
    :description="t('form.deleteFileDesc')"
    :confirm-label="t('action.delete')"
    @confirm="remove"
  />
</template>
