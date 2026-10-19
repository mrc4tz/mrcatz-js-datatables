<script setup lang="ts">
/** Satu field form daisyUI sesuai `FieldDef.type`. */
import { computed, ref, watch } from 'vue';
import { useMrcatz } from '../../config';
import { evalCondition, type FieldDef, type FieldOption, type FormValues } from '../../fields';
import MrcCombobox from '../MrcCombobox.vue';
import MrcIcon from '../MrcIcon.vue';

const props = defineProps<{ field: FieldDef; values: FormValues; error?: string; confirmError?: string; readonly?: boolean }>();
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
</script>

<template>
  <!-- Elemen statis -->
  <div v-if="f.type === 'section'" class="pt-2">
    <h4 class="text-sm font-semibold">{{ f.label }}</h4>
    <p v-if="f.text" class="text-base-content/60 text-xs">{{ f.text }}</p>
  </div>
  <p v-else-if="f.type === 'note'" class="text-base-content/70 text-sm">{{ f.text }}</p>
  <div v-else-if="f.type === 'alert'" role="alert" class="alert alert-soft text-sm" :class="alertTone[f.tone ?? 'info']">{{ f.text }}</div>
  <div v-else-if="f.type === 'divider'" class="divider my-0 text-xs">{{ f.text }}</div>
  <input v-else-if="f.type === 'hidden'" type="hidden" :name="name" :value="value" />

  <!-- Toggle & checkbox: label di samping -->
  <div v-else-if="f.type === 'toggle' || f.type === 'checkbox'" class="flex flex-col gap-1">
    <label class="flex cursor-pointer items-center gap-2 text-sm">
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
    <p v-else-if="f.hint" class="text-base-content/60 text-xs">{{ f.hint }}</p>
  </div>

  <fieldset v-else class="fieldset py-0">
    <label v-if="f.label" :for="inputId" class="fieldset-legend pb-1 pt-0 text-xs">
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
      class="textarea w-full"
      :class="{ 'textarea-error': error }"
      :rows="f.rows ?? 3"
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
    <label v-else class="input w-full" :class="{ 'input-error': error }">
      <MrcIcon v-if="f.icon" :name="f.icon" :size="15" class="opacity-50" />
      <span v-if="f.prefix" class="text-base-content/60 text-sm">{{ f.prefix }}</span>
      <input
        :id="inputId"
        :type="nativeType"
        class="grow"
        :placeholder="f.placeholder"
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

    <p v-if="error" class="text-error text-xs">{{ error }}</p>
    <p v-else-if="f.hint" class="text-base-content/60 text-xs">{{ f.hint }}</p>

    <!-- Konfirmasi password -->
    <template v-if="f.type === 'password' && f.confirm">
      <label :for="`${inputId}-confirm`" class="fieldset-legend pt-2 pb-1 text-xs">
        {{ typeof f.confirm === 'string' ? f.confirm : t('form.confirmLabel', { label: f.label ?? '' }) }}
      </label>
      <label class="input w-full" :class="{ 'input-error': confirmError }">
        <input
          :id="`${inputId}-confirm`"
          :type="showPassword ? 'text' : 'password'"
          class="grow"
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
