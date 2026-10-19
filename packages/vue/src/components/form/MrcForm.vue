<script setup lang="ts">
/**
 * Form builder berbasis definisi field (pengganti `form-builder.blade.php`).
 * Grid 12 kolom; `span` mengatur lebar (di layar kecil selalu penuh).
 *
 * @example
 * <MrcForm ref="form" v-model="values" :fields="fields" @submit="save" />
 */
import { computed } from 'vue';
import { useMrcatz } from '../../config';
import { isInput, isVisible, type FieldDef, type FormValues } from '../../fields';
import { validateFields, type FormErrors, type StandardSchema } from '../../validation';
import MrcFormField from './MrcFormField.vue';

const props = defineProps<{ fields: FieldDef[]; schema?: StandardSchema; readonly?: boolean }>();
const values = defineModel<FormValues>({ required: true });
const errors = defineModel<FormErrors>('errors', { default: () => ({}) });
const emit = defineEmits<{ submit: [values: FormValues] }>();
const { t } = useMrcatz();

const visible = computed(() => props.fields.filter((f) => isVisible(f, values.value)));
const spans: Record<number, string> = {
  1: 'sm:col-span-1', 2: 'sm:col-span-2', 3: 'sm:col-span-3', 4: 'sm:col-span-4', 5: 'sm:col-span-5', 6: 'sm:col-span-6',
  7: 'sm:col-span-7', 8: 'sm:col-span-8', 9: 'sm:col-span-9', 10: 'sm:col-span-10', 11: 'sm:col-span-11', 12: 'sm:col-span-12',
};

function update(name: string, value: unknown) {
  const next = { ...values.value, [name]: value };
  props.fields.find((f) => f.name === name)?.onChange?.(value, next);
  values.value = next;
  if (errors.value[name]) {
    const { [name]: _, ...rest } = errors.value;
    errors.value = rest;
  }
}

/** Validasi semua field yang terlihat. `true` bila valid. */
async function validate(): Promise<boolean> {
  errors.value = await validateFields(props.fields, values.value, t, props.schema);
  return Object.keys(errors.value).length === 0;
}

/** Nilai yang dikirim: hanya field terlihat (+ field hidden), tanpa konfirmasi password. */
function payload(): FormValues {
  const out: FormValues = {};
  for (const f of props.fields) {
    if (isInput(f) && (f.type === 'hidden' || isVisible(f, values.value))) out[f.name] = values.value[f.name];
  }
  if (values.value.id !== undefined && out.id === undefined) out.id = values.value.id;
  return out;
}

async function submit() {
  if (await validate()) emit('submit', payload());
}

defineExpose({ validate, payload, submit });
</script>

<template>
  <form class="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-12" novalidate @submit.prevent="submit">
    <div
      v-for="(f, i) in visible"
      :key="f.name ?? `${f.type}-${i}`"
      class="col-span-1"
      :class="[spans[f.span ?? 12] ?? 'sm:col-span-12', f.type === 'hidden' && 'hidden']"
    >
      <MrcFormField
        :field="f"
        :values="values"
        :error="f.name ? errors[f.name] : undefined"
        :confirm-error="f.name ? errors[`${f.name}_confirmation`] : undefined"
        :readonly="readonly"
        @update="update"
      >
        <template #default="slotProps">
          <slot :name="`field-${f.name}`" v-bind="slotProps" />
        </template>
      </MrcFormField>
    </div>
    <p v-if="errors._form" class="text-error col-span-full text-sm" role="alert">{{ errors._form }}</p>
    <slot name="footer" />
    <!-- Enter di input memicu submit -->
    <button type="submit" class="hidden" tabindex="-1" aria-hidden="true" />
  </form>
</template>
