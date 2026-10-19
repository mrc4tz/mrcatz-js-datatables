<script setup lang="ts">
/** Satu field form daisyUI sesuai `FieldDef.type`. */
import { computed, ref, watch } from 'vue';
import { useMrcatz } from '../../config';
import { TONE_BTN } from '../../columns';
import { evalCondition, type FieldActionContext, type FieldDef, type FieldOption, type FormValues } from '../../fields';
import { errorMessage } from '../../validation';
import MrcCombobox from '../MrcCombobox.vue';
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

// Opsi bisa statis atau bergantung pada nilai field lain (mis. kecamatan → desa).
const options = ref<FieldOption[]>([]);
const optionsLoading = ref(false);
watch(
  // Opsi fungsi hanya dihitung ulang saat field di `dependsOn` berubah (bukan tiap ketikan).
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
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  const buf = new Uint32Array(14);
  crypto.getRandomValues(buf);
  const pwd = [...buf].map((n) => chars[n % chars.length]).join('');
  set(pwd);
  if (f.value.confirm) set(pwd, `${name.value}_confirmation`);
  showPassword.value = true;
}

const tagDraft = ref('');
function addTag() {
  const v = tagDraft.value.trim();
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
const alertTone = { info: 'alert-info', success: 'alert-success', warning: 'alert-warning', error: 'alert-error' } as Record<string, string>;
const hintTone = { info: 'text-info', success: 'text-success', warning: 'text-warning', error: 'text-error' } as Record<string, string>;
// Gaya label & input mengikuti mrcatz/datatable versi Laravel.
const legendClass = 'fieldset-legend pb-1 pt-0 text-xs font-semibold text-base-content/70 uppercase tracking-wide';

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

const fileInput = ref<HTMLInputElement>();
const confirmDelete = ref(false);
function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !f.value.onUpload) return;
  props.ctx.clearError(name.value);
  if (f.value.maxSize && file.size > f.value.maxSize) {
    props.ctx.setError(name.value, t('form.max', { label: f.value.label ?? '', max: `${Math.round(f.value.maxSize / 1024)} KB` }));
    return;
  }
  void run(() => f.value.onUpload!(file, props.ctx));
}
function removeImage() {
  confirmDelete.value = false;
  void run(() => f.value.onDelete!(props.ctx));
}
</script>

<template>
  <!-- Elemen statis -->
  <div v-if="f.type === 'section'" class="pt-2">
    <h4 class="text-sm font-semibold text-base-content">{{ f.label }}</h4>
    <p v-if="f.text" class="text-base-content/60 text-xs">{{ f.text }}</p>
  </div>

  <!-- Tombol aksi: sejajar dengan input di sebelahnya (legend kosong sebagai pengganjal) -->
  <fieldset v-else-if="f.type === 'button'" class="fieldset py-0">
    <span :class="legendClass" aria-hidden="true">&nbsp;</span>
    <button
      type="button"
      class="btn w-full gap-2"
      :class="[TONE_BTN[f.tone ?? 'primary'], !f.label && 'btn-square']"
      :disabled="disabled || busy"
      :aria-label="f.label || f.icon"
      @click="run(() => f.onClick?.(ctx))"
    >
      <span v-if="busy" class="loading loading-spinner loading-xs" />
      <MrcIcon v-else-if="f.icon" :name="f.icon" :size="18" />
      <span v-if="f.label">{{ f.label }}</span>
    </button>
  </fieldset>

  <!-- Foto: pratinjau, unggah, hapus -->
  <fieldset v-else-if="f.type === 'image'" class="fieldset py-0">
    <span v-if="f.label" :class="legendClass">{{ f.label }}</span>
    <div class="flex flex-col items-center gap-3">
      <div class="relative">
        <MrcImage
          :src="f.preview ?? null"
          :alt="f.label"
          :fallback="f.fallback"
          :width="f.previewSize ?? 128"
          :height="f.previewSize ?? 128"
          :img-class="f.previewClass ?? 'rounded-full ring ring-primary ring-offset-base-100 ring-offset-2'"
        />
        <span v-if="busy" class="bg-base-100/60 absolute inset-0 flex items-center justify-center rounded-full">
          <span class="loading loading-spinner" />
        </span>
      </div>
      <div class="flex flex-wrap justify-center gap-2">
        <input ref="fileInput" type="file" class="hidden" :accept="f.accept" @change="onPick" />
        <button v-if="f.onUpload" type="button" class="btn btn-sm btn-primary btn-soft gap-1.5" :disabled="disabled || busy" @click="fileInput?.click()">
          <MrcIcon name="upload" :size="16" /> {{ t('form.upload') }}
        </button>
        <button
          v-if="f.onDelete && f.preview"
          type="button"
          class="btn btn-sm btn-error btn-soft gap-1.5"
          :disabled="disabled || busy"
          @click="f.deleteConfirm ? (confirmDelete = true) : removeImage()"
        >
          <MrcIcon name="trash" :size="15" /> {{ t('action.delete') }}
        </button>
      </div>
    </div>
    <p v-if="error" class="text-error mt-1 text-center text-xs">{{ error }}</p>
    <p v-else-if="f.hint" class="mt-1 text-center text-xs" :class="f.hintTone ? hintTone[f.hintTone] : 'text-base-content/60'">{{ f.hint }}</p>
    <MrcConfirm v-if="f.deleteConfirm" v-model:open="confirmDelete" :title="f.deleteConfirm" @confirm="removeImage" />
  </fieldset>
  <p v-else-if="f.type === 'note'" class="text-base-content/70 text-sm">{{ f.text }}</p>
  <div v-else-if="f.type === 'alert'" role="alert" class="alert alert-soft text-sm" :class="alertTone[f.tone ?? 'info']">{{ f.text }}</div>
  <div v-else-if="f.type === 'divider'" class="divider my-0 text-xs">{{ f.text }}</div>
  <input v-else-if="f.type === 'hidden'" type="hidden" :name="name" :value="value" />

  <!-- Toggle & checkbox: label di samping -->
  <div v-else-if="f.type === 'toggle' || f.type === 'checkbox'" class="flex flex-col gap-1">
    <label class="border-base-content/10 hover:bg-base-200/50 flex cursor-pointer items-center gap-3 rounded-field border p-3 text-sm font-medium transition-colors">
      <input
        :id="inputId"
        type="checkbox"
        :class="f.type === 'toggle' ? 'toggle toggle-sm toggle-primary' : 'checkbox checkbox-sm checkbox-primary'"
        :checked="!!value"
        :disabled="disabled"
        @change="set(($event.target as HTMLInputElement).checked)"
      />
      <span>{{ f.label }}<span v-if="required" class="text-error"> *</span></span>
    </label>
    <p v-if="error" class="text-error text-xs">{{ error }}</p>
    <p v-else-if="f.hint" class="text-xs" :class="f.hintTone ? hintTone[f.hintTone] : 'text-base-content/60'">{{ f.hint }}</p>
  </div>

  <fieldset v-else class="fieldset py-0">
    <label v-if="f.label" :for="inputId" :class="legendClass">
      {{ f.label }}<span v-if="required" class="text-error">*</span>
    </label>

    <slot v-if="f.type === 'slot'" :value="value" :set="set" :disabled="disabled" />

    <MrcCombobox
      v-else-if="f.type === 'select'"
      :id="inputId"
      :model-value="value"
      :options="options"
      :placeholder="f.placeholder"
      :disabled="disabled"
      :loading="optionsLoading"
      :error="!!error"
      size="md"
      :clearable="!required"
      :clear-label="t('form.choose')"
      @update:model-value="set($event)"
    />

    <div v-else-if="f.type === 'radio'" class="flex flex-wrap gap-x-4 gap-y-1.5 py-1" role="radiogroup">
      <label v-for="o in options" :key="String(o.value)" class="flex cursor-pointer items-center gap-2 text-sm">
        <input type="radio" class="radio radio-sm radio-primary" :name="inputId" :checked="value === o.value" :disabled="disabled" @change="set(o.value)" />
        {{ o.label }}
      </label>
    </div>

    <textarea
      v-else-if="f.type === 'textarea'"
      :id="inputId"
      class="textarea focus:textarea-primary w-full text-sm transition-all duration-200 focus:shadow-sm"
      :class="{ 'textarea-error': error }"
      :rows="f.rows ?? 4"
      :placeholder="f.placeholder"
      :maxlength="f.maxLength"
      :disabled="disabled"
      :value="value as string"
      @input="set(($event.target as HTMLTextAreaElement).value)"
    />

    <div v-else-if="f.type === 'tags'" class="input h-auto min-h-10 w-full flex-wrap gap-1 py-1.5" :class="{ 'input-error': error }">
      <span v-for="tag in (value as string[]) ?? []" :key="tag" class="badge badge-soft badge-primary gap-1 pr-1">
        {{ tag }}
        <button type="button" class="btn btn-ghost btn-xs btn-circle size-4 min-h-0" :disabled="disabled" @click="set(((value as string[]) ?? []).filter((x) => x !== tag))">
          <MrcIcon name="x" :size="10" />
        </button>
      </span>
      <input
        :id="inputId"
        v-model="tagDraft"
        class="min-w-24 flex-1"
        :placeholder="f.placeholder ?? t('form.addTag')"
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
      class="file-input w-full"
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
      class="h-10 w-20 cursor-pointer rounded-field border-0 bg-transparent"
      :value="(value as string) || '#000000'"
      :disabled="disabled"
      @input="set(($event.target as HTMLInputElement).value)"
    />

    <!-- input teks umum -->
    <label
      v-else
      class="input focus-within:input-primary w-full gap-3 transition-all duration-200 focus-within:shadow-sm"
      :class="{ 'input-error': error, 'bg-base-200 opacity-60': disabled }"
    >
      <MrcIcon v-if="f.icon" :name="f.icon" :size="18" class="text-base-content/40" />
      <span v-if="f.prefix" class="text-base-content/60 text-sm">{{ f.prefix }}</span>
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
        @input="set(f.type === 'number' || f.type === 'year' ? (($event.target as HTMLInputElement).value === '' ? '' : Number(($event.target as HTMLInputElement).value)) : ($event.target as HTMLInputElement).value)"
      />
      <span v-if="f.suffix" class="text-base-content/60 text-sm">{{ f.suffix }}</span>
      <template v-if="f.type === 'password'">
        <button v-if="f.generate !== false" type="button" class="btn btn-ghost btn-xs" :disabled="disabled" @click="generatePassword">{{ t('form.generate') }}</button>
        <button
          v-if="f.reveal !== false"
          type="button"
          class="btn btn-ghost btn-xs btn-square"
          :aria-label="showPassword ? t('form.hidePassword') : t('form.showPassword')"
          @click="showPassword = !showPassword"
        >
          <MrcIcon :name="showPassword ? 'eye-off' : 'eye'" :size="15" />
        </button>
      </template>
    </label>

    <p v-if="error" class="text-error flex items-center gap-1 text-xs"><MrcIcon name="alert" :size="12" />{{ error }}</p>
    <p v-else-if="f.hint" class="text-xs" :class="f.hintTone ? hintTone[f.hintTone] : 'text-base-content/60'">{{ f.hint }}</p>

    <!-- Konfirmasi password -->
    <template v-if="f.type === 'password' && f.confirm">
      <label :for="`${inputId}-confirm`" :class="[legendClass, 'pt-3']">
        {{ typeof f.confirm === 'string' ? f.confirm : t('form.confirmLabel', { label: f.label ?? '' }) }}
      </label>
      <label class="input focus-within:input-primary w-full gap-3 transition-all duration-200" :class="{ 'input-error': confirmError }">
        <MrcIcon v-if="f.icon" :name="f.icon" :size="18" class="text-base-content/40" />
        <input
          :id="`${inputId}-confirm`"
          :type="showPassword ? 'text' : 'password'"
          class="min-w-0 grow text-sm"
          autocomplete="new-password"
          :disabled="disabled"
          :value="values[`${name}_confirmation`]"
          @input="set(($event.target as HTMLInputElement).value, `${name}_confirmation`)"
        />
      </label>
      <p v-if="confirmError" class="text-error text-xs">{{ confirmError }}</p>
    </template>
  </fieldset>
</template>
