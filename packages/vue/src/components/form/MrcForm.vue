<script setup lang="ts">
/**
 * Form builder berbasis definisi field (pengganti `form-builder.blade.php`).
 * Grid 12 kolom; `span` mengatur lebar (di layar kecil selalu penuh).
 * Section dengan `card: true` memecah form menjadi beberapa kartu
 * (pengganti `->asCard()`), cocok untuk halaman pengaturan/profil.
 *
 * @example
 * <MrcForm ref="form" v-model="values" :fields="fields" @submit="save" />
 */
import { computed, nextTick } from 'vue';
import { useMrcatz } from '../../config';
import { isInput, isVisible, type FieldActionContext, type FieldDef, type FormValues } from '../../fields';
import { validateFields, type FormErrors, type StandardSchema } from '../../validation';
import MrcFormField from './MrcFormField.vue';

const props = defineProps<{ fields: FieldDef[]; schema?: StandardSchema; readonly?: boolean }>();
const values = defineModel<FormValues>({ required: true });
const errors = defineModel<FormErrors>('errors', { default: () => ({}) });
const emit = defineEmits<{ submit: [values: FormValues] }>();
const { t } = useMrcatz();

// Kelas literal agar terdeteksi pemindai Tailwind.
const spans: Record<number, string> = {
  1: 'sm:col-span-1', 2: 'sm:col-span-2', 3: 'sm:col-span-3', 4: 'sm:col-span-4', 5: 'sm:col-span-5', 6: 'sm:col-span-6',
  7: 'sm:col-span-7', 8: 'sm:col-span-8', 9: 'sm:col-span-9', 10: 'sm:col-span-10', 11: 'sm:col-span-11', 12: 'sm:col-span-12',
};
const rowSpans: Record<number, string> = { 2: 'sm:row-span-2', 3: 'sm:row-span-3', 4: 'sm:row-span-4', 5: 'sm:row-span-5', 6: 'sm:row-span-6' };

interface Group {
  title?: string;
  text?: string;
  fields: FieldDef[];
}

/** Pecah field menjadi kartu bila ada section `card: true`; selain itu satu grup tanpa kartu. */
const groups = computed<{ cards: boolean; list: Group[] }>(() => {
  const visible = props.fields.filter((f) => isVisible(f, values.value));
  if (!visible.some((f) => f.type === 'section' && f.card)) return { cards: false, list: [{ fields: visible }] };
  const list: Group[] = [];
  let cur: Group = { fields: [] };
  for (const f of visible) {
    if (f.type === 'section' && f.card) {
      if (cur.fields.length || cur.title) list.push(cur);
      cur = { title: f.label, text: f.text, fields: [] };
    } else cur.fields.push(f);
  }
  if (cur.fields.length || cur.title) list.push(cur);
  return { cards: true, list };
});

/*
 * `v-model` baru diperbarui induk setelah render berikutnya. Beberapa perubahan
 * dalam satu tick (mis. "Buat acak" mengisi password + konfirmasi, atau
 * `ctx.set` berturut-turut) harus menumpuk di atas nilai terakhir, bukan
 * menimpa satu sama lain — jadi simpan salinan terbaru sampai tick selesai.
 */
let pendingValues: FormValues | null = null;
let pendingErrors: FormErrors | null = null;
const latestValues = () => pendingValues ?? values.value;
const latestErrors = () => pendingErrors ?? errors.value;
function commitValues(next: FormValues) {
  if (!pendingValues) void nextTick(() => (pendingValues = null));
  pendingValues = next;
  values.value = next;
}
function commitErrors(next: FormErrors) {
  if (!pendingErrors) void nextTick(() => (pendingErrors = null));
  pendingErrors = next;
  errors.value = next;
}

function setError(name: string, message: string) {
  commitErrors({ ...latestErrors(), [name]: message });
}
function clearError(name: string) {
  const cur = latestErrors();
  if (!(name in cur)) return;
  const { [name]: _, ...rest } = cur;
  commitErrors(rest);
}

function update(name: string, value: unknown) {
  const next = { ...latestValues(), [name]: value };
  props.fields.find((f) => f.name === name)?.onChange?.(value, next);
  commitValues(next);
  clearError(name);
}

const ctx: FieldActionContext = {
  get values() {
    return latestValues();
  },
  set: update,
  setError,
  clearError,
};

/** Validasi semua field yang terlihat. `true` bila valid. */
async function validate(): Promise<boolean> {
  const next = await validateFields(props.fields, latestValues(), t, props.schema);
  commitErrors(next);
  return Object.keys(next).length === 0;
}

/** Nilai yang dikirim: hanya field terlihat (+ field hidden), tanpa konfirmasi password. */
function payload(): FormValues {
  const cur = latestValues();
  const out: FormValues = {};
  for (const f of props.fields) {
    if (isInput(f) && (f.type === 'hidden' || isVisible(f, cur))) out[f.name] = cur[f.name];
  }
  if (cur.id !== undefined && out.id === undefined) out.id = cur.id;
  return out;
}

async function submit() {
  if (await validate()) emit('submit', payload());
}

defineExpose({ validate, payload, submit, setError, clearError });
</script>

<template>
  <form class="flex flex-col gap-6" novalidate @submit.prevent="submit">
    <component
      :is="groups.cards ? 'section' : 'div'"
      v-for="(g, gi) in groups.list"
      :key="gi"
      :class="groups.cards && 'card bg-base-100 shadow-sm'"
    >
      <div :class="groups.cards && 'card-body'">
        <template v-if="g.title">
          <h2 class="card-title text-base-content text-base">{{ g.title }}</h2>
          <p v-if="g.text" class="text-base-content/60 -mt-1 text-sm">{{ g.text }}</p>
          <div class="divider mt-0 mb-2" />
        </template>
        <div class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-12">
          <div
            v-for="(f, i) in g.fields"
            :key="f.name ?? `${f.type}-${gi}-${i}`"
            class="col-span-1 min-w-0"
            :class="[
              spans[f.span ?? 12] ?? 'sm:col-span-12',
              f.rowSpan && rowSpans[f.rowSpan],
              f.type === 'hidden' && 'hidden',
              f.mobileOrder !== undefined && 'max-sm:order-(--mrc-order)',
            ]"
            :style="f.mobileOrder !== undefined ? { '--mrc-order': f.mobileOrder } : undefined"
          >
            <MrcFormField
              :field="f"
              :values="values"
              :ctx="ctx"
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
        </div>
      </div>
    </component>
    <p v-if="errors._form" class="text-error text-sm" role="alert">{{ errors._form }}</p>
    <slot name="footer" />
    <!-- Enter di input memicu submit -->
    <button type="submit" class="hidden" tabindex="-1" aria-hidden="true" />
  </form>
</template>

