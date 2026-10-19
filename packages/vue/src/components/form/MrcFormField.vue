<script setup lang="ts">
/** Satu field form — markup sama dengan `partials/form/*.blade.php` versi Laravel. */
import { computed, ref, watch } from 'vue';
import { useMrcatz } from '../../config';
import { TONE_BTN } from '../../columns';
import { evalCondition, type FieldActionContext, type FieldDef, type FieldOption, type FormValues } from '../../fields';
import { errorMessage } from '../../validation';
import MrcConfirm from '../MrcConfirm.vue';
import MrcIcon from '../MrcIcon.vue';
import MrcImage from '../table/MrcImage.vue';

const props = defineProps<{
  field: FieldDef;
  values: FormValues;
  error?: string;
  confirmError?: string;
  readonly?: boolean;
  ctx: FieldActionContext;
}>();
const emit = defineEmits<{ update: [name: string, value: unknown] }>();
const { t } = useMrcatz();

const f = computed(() => props.field);
const name = computed(() => f.value.name ?? '');
const value = computed(() => props.values[name.value]);
const inputId = computed(() => `mrc-f-${name.value}`);
const disabled = computed(() => props.readonly || evalCondition(f.value.disabled, props.values));
const required = computed(() => evalCondition(f.value.required, props.values));

function set(v: unknown, key = name.value) {
  emit('update', key, v);
}

// Opsi bisa statis atau dimuat ulang saat field di `dependsOn` berubah.
const options = ref<FieldOption[]>([]);
const optionsLoading = ref(false);
watch(
  () => [f.value.options, ...(f.value.dependsOn ?? []).map((k) => props.values[k])],
  async () => {
    const src = f.value.options;
    if (!src) return (options.value = []);
    if (typeof src !== 'function') return (options.value = src);
    optionsLoading.value = true;
    try {
      options.value = await src(props.values);
    } finally {
      optionsLoading.value = false;
    }
  },
  { immediate: true },
);

const showPassword = ref(false);
function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
  const buf = new Uint32Array(16);
  crypto.getRandomValues(buf);
  const pwd = [...buf].map((n) => chars[n % chars.length]).join('');
  set(pwd);
  if (f.value.confirm) set(pwd, `${name.value}_confirmation`);
  showPassword.value = true;
}

const tagDraft = ref('');
function addTag() {
  const v = tagDraft.value.trim().replace(/,$/, '');
  const list = (value.value as string[]) ?? [];
  if (v && !list.includes(v)) set([...list, v]);
  tagDraft.value = '';
}

const nativeType = computed(() => {
  switch (f.value.type) {
    case 'datetime':
      return 'datetime-local';
    case 'year':
      return 'number';
    case 'password':
      return showPassword.value ? 'text' : 'password';
    default:
      return f.value.type;
  }
});
const isNumber = computed(() => f.value.type === 'number' || f.value.type === 'year');
const hintTone = { info: 'text-info', success: 'text-success', warning: 'text-warning', error: 'text-error' } as Record<string, string>;
const hintClass = computed(() => (f.value.hintTone ? hintTone[f.value.hintTone] : 'text-base-content/50'));
const alert = computed(() => {
  const tone = f.value.tone ?? 'info';
  return {
    cls: { warning: 'alert-warning', success: 'alert-success', error: 'alert-error' }[tone as string] ?? 'alert-info',
    icon: ({ warning: 'warning', error: 'error', success: 'check_circle' } as const)[tone as 'warning' | 'error' | 'success'] ?? 'info',
  };
});

// ---------------------------------------------------------------- tombol & gambar
const busy = ref(false);
async function run(fn: () => unknown) {
  busy.value = true;
  try {
    await fn();
  } catch (e) {
    if (name.value) props.ctx.setError(name.value, errorMessage(e, t('crud.failed')));
  } finally {
    busy.value = false;
  }
}

const pickedFile = ref<File | null>(null);
const fileInput = ref<HTMLInputElement>();
const confirmDelete = ref(false);
function onPick(e: Event) {
  pickedFile.value = (e.target as HTMLInputElement).files?.[0] ?? null;
  props.ctx.clearError(name.value);
}
function upload() {
  const file = pickedFile.value;
  if (!file || !f.value.onUpload) return;
  if (f.value.maxSize && file.size > f.value.maxSize) {
    props.ctx.setError(name.value, t('form.max', { label: f.value.label ?? '', max: `${Math.round(f.value.maxSize / 1024)} KB` }));
    return;
  }
  void run(async () => {
    await f.value.onUpload!(file, props.ctx);
    pickedFile.value = null;
    if (fileInput.value) fileInput.value.value = '';
  });
}
function removeImage() {
  confirmDelete.value = false;
  void run(() => f.value.onDelete!(props.ctx));
}

const legend = 'fieldset-legend text-xs font-semibold text-base-content/70 uppercase tracking-wide';
const inputBox = 'input input-bordered flex items-center gap-3 w-full transition-all duration-200 focus-within:shadow-sm';
</script>

<template>
  <!-- Elemen statis -->
  <h2 v-if="f.type === 'section'" class="border-base-content/10 text-base-content mt-4 mb-1 border-b pb-2 text-lg font-semibold">{{ f.label }}</h2>
  <p v-else-if="f.type === 'note'" class="text-base-content/60 mb-1 text-sm">{{ f.text }}</p>
  <div v-else-if="f.type === 'divider'" class="divider" :class="f.text && 'text-base-content/50 text-sm'">{{ f.text }}</div>
  <div v-else-if="f.type === 'alert'" class="alert text-sm" :class="alert.cls">
    <MrcIcon :name="alert.icon" class="shrink-0" />
    <span>{{ f.text }}</span>
  </div>
  <input v-else-if="f.type === 'hidden'" type="hidden" :name="name" :value="value" />

  <!-- Tombol aksi -->
  <fieldset v-else-if="f.type === 'button'" class="fieldset">
    <legend :class="legend">&nbsp;</legend>
    <button type="button" class="btn w-full gap-2" :class="TONE_BTN[f.tone ?? 'primary']" :disabled="disabled || busy" @click="run(() => f.onClick?.(ctx))">
      <span v-if="busy" class="loading loading-spinner loading-xs" />
      <MrcIcon v-if="f.icon" :name="f.icon" />
      {{ f.label }}
    </button>
    <p v-if="f.hint" class="mt-1 text-xs" :class="hintClass">{{ f.hint }}</p>
  </fieldset>

  <!-- Foto -->
  <fieldset v-else-if="f.type === 'image'" class="fieldset">
    <legend :class="legend">{{ f.label }}</legend>
    <div class="flex flex-col items-center gap-4" :class="f.onUpload && 'border-base-content/10 bg-base-200/20 rounded-lg border p-4'">
      <MrcImage
        :src="f.preview ?? null"
        :alt="f.label"
        :fallback="f.fallback"
        :width="f.previewSize ?? 128"
        :height="f.previewSize ?? 128"
        :img-class="f.previewClass ?? 'rounded-full ring ring-primary ring-offset-base-100 ring-offset-2'"
        fallback-class="text-4xl font-bold text-primary"
      />
      <div v-if="f.onUpload" class="w-full max-w-xs">
        <input
          ref="fileInput"
          type="file"
          class="file-input file-input-bordered file-input-sm w-full"
          :class="{ 'file-input-error': error }"
          :accept="f.accept"
          :disabled="disabled || busy"
          @change="onPick"
        />
        <p v-if="error" class="text-error mt-1 flex items-center gap-1 text-xs"><MrcIcon name="error" :size="14" />{{ error }}</p>
        <div class="mt-3 flex gap-2">
          <button type="button" class="btn btn-primary btn-sm flex-1 gap-1" :disabled="disabled || busy || !pickedFile" @click="upload">
            <span v-if="busy" class="loading loading-spinner loading-xs" />
            {{ t('action.upload') }}
          </button>
          <button
            v-if="f.onDelete && f.preview"
            type="button"
            class="btn btn-error btn-sm btn-outline gap-1"
            :disabled="disabled || busy"
            :aria-label="t('action.delete')"
            @click="confirmDelete = true"
          >
            <MrcIcon name="delete" :size="16" />
          </button>
        </div>
      </div>
      <p v-if="f.hint" class="mt-1 text-xs" :class="hintClass">{{ f.hint }}</p>
    </div>
    <MrcConfirm
      v-if="f.onDelete"
      v-model:open="confirmDelete"
      variant="large"
      :title="f.deleteConfirm ?? t('form.deletePhoto')"
      :description="t('form.deletePhotoDesc')"
      :confirm-label="t('action.delete')"
      @confirm="removeImage"
    />
  </fieldset>

  <!-- Toggle & checkbox -->
  <fieldset v-else-if="f.type === 'toggle' || f.type === 'checkbox'" class="fieldset">
    <label
      class="label border-base-content/10 hover:bg-base-200/50 cursor-pointer justify-start gap-3 rounded-lg border p-3 transition-colors duration-200"
      :class="disabled && 'bg-base-200 opacity-60'"
    >
      <input
        :id="inputId"
        type="checkbox"
        :class="f.type === 'toggle' ? 'toggle toggle-primary' : 'checkbox checkbox-primary'"
        :checked="!!value"
        :disabled="disabled"
        @change="set(($event.target as HTMLInputElement).checked)"
      />
      <span class="text-base-content text-sm font-medium">{{ f.label }}</span>
    </label>
    <p v-if="error" class="text-error mt-1 flex items-center gap-1 text-xs"><MrcIcon name="error" :size="14" />{{ error }}</p>
    <p v-if="f.hint" class="mt-1 text-xs" :class="hintClass">{{ f.hint }}</p>
  </fieldset>

  <fieldset v-else class="fieldset">
    <legend v-if="f.label" :class="legend">{{ f.label }}</legend>

    <slot v-if="f.type === 'slot'" :value="value" :set="set" :disabled="disabled" />

    <select
      v-else-if="f.type === 'select'"
      :id="inputId"
      class="select select-bordered w-full text-sm transition-all duration-200 focus:shadow-sm"
      :class="{ 'select-error': error, 'bg-base-200 opacity-60': disabled }"
      :disabled="disabled || optionsLoading"
      @change="set(options[($event.target as HTMLSelectElement).selectedIndex - 1]?.value ?? '')"
    >
      <option value="" :selected="value === '' || value === null || value === undefined">-- {{ f.placeholder ?? f.label }} --</option>
      <option v-for="o in options" :key="String(o.value)" :value="String(o.value)" :selected="String(o.value) === String(value)">{{ o.label }}</option>
    </select>

    <div v-else-if="f.type === 'radio'" class="border-base-content/10 flex flex-wrap gap-4 rounded-lg border p-3" :class="disabled && 'bg-base-200 opacity-60'" role="radiogroup">
      <label v-for="o in options" :key="String(o.value)" class="flex cursor-pointer items-center gap-2">
        <input type="radio" class="radio radio-primary" :name="inputId" :checked="value === o.value" :disabled="disabled" @change="set(o.value)" />
        <span class="text-sm">{{ o.label }}</span>
      </label>
    </div>

    <textarea
      v-else-if="f.type === 'textarea'"
      :id="inputId"
      class="textarea textarea-bordered w-full text-sm transition-all duration-200 focus:shadow-sm"
      :class="[{ 'textarea-error': error, 'bg-base-200 opacity-60': disabled }, f.rows ? '' : 'h-28']"
      :rows="f.rows"
      :placeholder="f.placeholder ?? '...'"
      :maxlength="f.maxLength"
      :disabled="disabled"
      :value="value as string"
      @input="set(($event.target as HTMLTextAreaElement).value)"
    />

    <div v-else-if="f.type === 'tags'" :class="[inputBox, 'h-auto min-h-10 flex-wrap gap-1 py-1.5', error && 'input-error']">
      <span v-for="tag in (value as string[]) ?? []" :key="tag" class="badge badge-primary gap-1">
        {{ tag }}
        <button type="button" :disabled="disabled" @click="set(((value as string[]) ?? []).filter((x) => x !== tag))"><MrcIcon name="close" :size="12" /></button>
      </span>
      <input
        :id="inputId"
        v-model="tagDraft"
        class="min-w-24 flex-1 text-sm"
        :placeholder="f.placeholder ?? '...'"
        :disabled="disabled"
        @keydown.enter.prevent="addTag"
        @keydown.,.prevent="addTag"
        @blur="addTag"
      />
    </div>

    <input
      v-else-if="f.type === 'file'"
      :id="inputId"
      type="file"
      class="file-input file-input-bordered w-full"
      :class="{ 'file-input-error': error }"
      :accept="f.accept"
      :multiple="f.multiple"
      :disabled="disabled"
      @change="set(f.multiple ? [...(($event.target as HTMLInputElement).files ?? [])] : (($event.target as HTMLInputElement).files?.[0] ?? null))"
    />

    <div v-else-if="f.type === 'range'" class="flex items-center gap-3">
      <input
        :id="inputId"
        type="range"
        class="range range-primary range-sm flex-1"
        :min="f.min ?? 0"
        :max="f.max ?? 100"
        :step="f.step ?? 1"
        :value="value as number"
        :disabled="disabled"
        @input="set(Number(($event.target as HTMLInputElement).value))"
      />
      <span class="w-10 text-right text-sm tabular-nums">{{ value }}</span>
    </div>

    <input
      v-else-if="f.type === 'color'"
      :id="inputId"
      type="color"
      class="h-10 w-20 cursor-pointer rounded-lg border-0 bg-transparent"
      :value="(value as string) || '#000000'"
      :disabled="disabled"
      @input="set(($event.target as HTMLInputElement).value)"
    />

    <!-- Input teks / angka / tanggal -->
    <label v-else :class="[inputBox, error && 'input-error', disabled && 'bg-base-200 opacity-60']">
      <span v-if="f.icon" class="text-base-content/40 inline-flex shrink-0 items-center justify-center self-center"><MrcIcon :name="f.icon" /></span>
      <span v-if="f.prefix" class="text-base-content/50 shrink-0 text-sm font-medium">{{ f.prefix }}</span>
      <input
        :id="inputId"
        :type="nativeType"
        class="min-w-0 grow text-sm"
        :placeholder="f.placeholder ?? '...'"
        :min="f.type === 'year' ? (f.min ?? 1900) : f.min"
        :max="f.type === 'year' ? (f.max ?? 2100) : f.max"
        :step="f.step"
        :maxlength="f.maxLength"
        :disabled="disabled"
        :value="value as string"
        :autocomplete="f.type === 'password' ? 'new-password' : undefined"
        @input="set(isNumber ? (($event.target as HTMLInputElement).value === '' ? '' : Number(($event.target as HTMLInputElement).value)) : ($event.target as HTMLInputElement).value)"
      />
      <span v-if="f.suffix" class="text-base-content/50 shrink-0 text-sm font-medium">{{ f.suffix }}</span>
      <template v-if="f.type === 'password' && !disabled">
        <button
          v-if="f.generate !== false"
          type="button"
          tabindex="-1"
          class="text-base-content/40 hover:text-base-content/70 shrink-0 cursor-pointer transition-colors"
          :aria-label="t('form.generate')"
          :title="t('form.generate')"
          @click="generatePassword"
        >
          <MrcIcon name="autorenew" />
        </button>
        <button
          v-if="f.reveal !== false"
          type="button"
          tabindex="-1"
          class="hover:text-base-content/70 shrink-0 cursor-pointer transition-colors"
          :class="showPassword ? 'text-base-content/70' : 'text-base-content/40'"
          :aria-label="showPassword ? t('form.hidePassword') : t('form.showPassword')"
          @click="showPassword = !showPassword"
        >
          <MrcIcon :name="showPassword ? 'visibility_off' : 'visibility'" />
        </button>
      </template>
    </label>

    <p v-if="error" class="text-error mt-1 flex items-center gap-1 text-xs"><MrcIcon name="error" :size="14" />{{ error }}</p>
    <p v-if="f.hint" class="mt-1 text-xs" :class="hintClass">{{ f.hint }}</p>
  </fieldset>

  <!-- Konfirmasi password: field terpisah, sama seperti `->withConfirmation()` -->
  <fieldset v-if="f.type === 'password' && f.confirm" class="fieldset mt-4">
    <legend :class="legend">{{ typeof f.confirm === 'string' ? f.confirm : t('form.confirmLabel', { label: f.label ?? '' }) }}</legend>
    <label :class="[inputBox, confirmError && 'input-error', disabled && 'bg-base-200 opacity-60']">
      <span v-if="f.icon" class="text-base-content/40 inline-flex shrink-0 items-center justify-center self-center"><MrcIcon :name="f.icon" /></span>
      <input
        :id="`${inputId}-confirm`"
        :type="showPassword ? 'text' : 'password'"
        class="min-w-0 grow text-sm"
        placeholder="..."
        autocomplete="new-password"
        :disabled="disabled"
        :value="values[`${name}_confirmation`]"
        @input="set(($event.target as HTMLInputElement).value, `${name}_confirmation`)"
      />
    </label>
    <p v-if="confirmError" class="text-error mt-1 flex items-center gap-1 text-xs"><MrcIcon name="error" :size="14" />{{ confirmError }}</p>
  </fieldset>
</template>
