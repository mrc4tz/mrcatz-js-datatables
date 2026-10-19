<script setup lang="ts" generic="T extends Record<string, any>">
/**
 * Halaman CRUD siap pakai: `MrcDataTable` + form tambah/edit + konfirmasi
 * hapus + notifikasi + refresh otomatis. Semua prop `MrcDataTable` lain
 * (columns, source, filters, bulkActions, ...) diteruskan apa adanya.
 *
 * Pengganti pola Laravel `MrCatzComponent` (prepareAddData / prepareEditData /
 * prepareDeleteData / saveData / dropData / dropBulkData).
 *
 * <MrcCrudTable
 *   name="pengguna" entity="Pengguna"
 *   :source="source" :columns="columns" :fields="fields"
 *   :create="(v) => api.post('/pengguna', v)"
 *   :update="(row, v) => api.patch(`/pengguna/${row.id}`, v)"
 *   :remove="(row) => api.delete(`/pengguna/${row.id}`)"
 *   :remove-many="(rows) => api.post('/pengguna/bulk-delete', { ids: rows.map(r => r.id) })"
 * />
 *
 * Form tulisan tangan (pengganti `@section('forms')` saat `setForm()` kosong):
 * isi slot `#form="{ values, errors, set, mode, row, submit }"`; modal, tombol
 * Simpan, validasi `schema`, notifikasi, dan refresh tetap ditangani di sini.
 */
import { computed, nextTick, ref, useAttrs, watch } from 'vue';
import { useMrcatz } from '../config';
import { initialValues, type CrudMode, type FieldDef, type FormValues } from '../fields';
import { errorMessage, MrcFormError, validateFields, type FormErrors, type StandardSchema } from '../validation';
import MrcDataTable from './MrcDataTable.vue';
import MrcModal from './MrcModal.vue';
import MrcConfirm from './MrcConfirm.vue';
import MrcIcon from './MrcIcon.vue';
import MrcForm from './form/MrcForm.vue';
import MrcFormPageShell from './form/MrcFormPageShell.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    /** Nama entitas untuk judul form & notifikasi, mis. "Pengguna". */
    entity: string;
    /** Definisi field form. Boleh kosong bila memakai slot `#form`. */
    fields?: FieldDef[] | ((ctx: { mode: CrudMode; row: T | null }) => FieldDef[]);
    schema?: StandardSchema;
    create?: (values: FormValues) => unknown;
    update?: (row: T, values: FormValues) => unknown;
    remove?: (row: T) => unknown;
    removeMany?: (rows: T[]) => unknown;
    /** Ubah baris menjadi nilai form saat edit (pengganti `prepareEditData`). Default: salin baris. */
    toFormValues?: (row: T) => FormValues | Promise<FormValues>;
    /** Nilai awal saat tambah (pengganti `prepareAddData`). */
    defaultValues?: FormValues | (() => FormValues);
    /** Teks yang ditampilkan di konfirmasi hapus (pengganti `deleted_text`). */
    deleteLabel?: (row: T) => string;
    formTitle?: (mode: CrudMode, row: T | null) => string;
    formSize?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    /** Tutup form saat klik di luar / Esc (pengganti `$modalDismissOnClickOutside`). Default false. */
    formDismissible?: boolean;
    /** Jarak antar-field / antar-kolom form (pengganti `$formGap` / `$formColumnGap`). */
    formGap?: string;
    formColumnGap?: string;
    /**
     * Form menggantikan area tabel, bukan modal (pengganti `$modalFullScreen`).
     * Cocok untuk form panjang / editor rich text.
     */
    formPage?: boolean;
    /** Gaya bingkai form halaman penuh (pengganti `$formPageCard` / `$formPageBorder`). */
    formPageCard?: boolean;
    formPageBorder?: boolean;
    /** Dialog hapus bisa ditutup dengan klik di luar / Esc (pengganti `$deleteModalDismissOnClickOutside`). Default true. */
    deleteDismissible?: boolean;
  }>(),
  { formSize: 'lg', formDismissible: false, formPage: false, formPageCard: true, formPageBorder: false, deleteDismissible: true },
);
const emit = defineEmits<{
  saved: [mode: CrudMode, values: FormValues, result: unknown];
  deleted: [rows: T[]];
  /** Form tambah/edit dibuka (pengganti event `mrcatz-form-page-opened`). */
  'form-open': [mode: CrudMode, row: T | null];
  /** Form ditutup — batal maupun setelah simpan (pengganti `mrcatz-form-page-closed`). */
  'form-close': [mode: CrudMode];
}>();
const attrs = useAttrs();
const slots = defineSlots<{
  /** Form tulisan tangan pengganti `MrcForm`. */
  form?(props: {
    values: FormValues;
    errors: FormErrors;
    set: (name: string, value: unknown) => void;
    mode: CrudMode;
    row: T | null;
    saving: boolean;
    submit: () => Promise<void>;
  }): unknown;
  // Slot lain (`#cell-*`, `#field-*`, `#empty`, ...) diteruskan ke tabel/form.
  [name: string]: ((props: any) => unknown) | undefined;
}>();
/** Slot yang diteruskan ke tabel — `form` dipakai sendiri oleh modal. */
const tableSlots = computed(() => Object.keys(slots).filter((n) => n !== 'form'));
const { t, notify } = useMrcatz();

const tableRef = ref<{ refresh: () => Promise<void> }>();
const formRef = ref<InstanceType<typeof MrcForm>>();

const formOpen = ref(false);
const mode = ref<CrudMode>('create');
const current = ref<T | null>(null);
const values = ref<FormValues>({});
const errors = ref<FormErrors>({});
const saving = ref(false);
const preparing = ref(false);

const activeFields = computed(() =>
  typeof props.fields === 'function' ? props.fields({ mode: mode.value, row: current.value }) : (props.fields ?? []),
);
const title = computed(() =>
  props.formTitle
    ? props.formTitle(mode.value, current.value)
    : t(mode.value === 'create' ? 'crud.addTitle' : 'crud.editTitle', { entity: props.entity }),
);

function openCreate() {
  mode.value = 'create';
  current.value = null;
  const defaults = typeof props.defaultValues === 'function' ? props.defaultValues() : (props.defaultValues ?? {});
  values.value = initialValues(activeFields.value, defaults);
  errors.value = {};
  formOpen.value = true;
}

async function openEdit(row: T) {
  mode.value = 'edit';
  current.value = row;
  errors.value = {};
  preparing.value = true;
  formOpen.value = true;
  try {
    const base = props.toFormValues ? await props.toFormValues(row) : { ...row };
    values.value = initialValues(activeFields.value, base);
  } catch (e) {
    formOpen.value = false;
    notify('error', errorMessage(e, t('crud.failed')));
  } finally {
    preparing.value = false;
  }
}

async function save(payload: FormValues) {
  saving.value = true;
  try {
    const result =
      mode.value === 'create' ? await props.create?.(payload) : await props.update?.(current.value as T, payload);
    void closeForm();
    notify('success', `${props.entity} ${t('crud.success')} ${t(mode.value === 'create' ? 'crud.added' : 'crud.updated')}`);
    emit('saved', mode.value, payload, result);
    await tableRef.value?.refresh();
  } catch (e) {
    if (e instanceof MrcFormError) errors.value = e.fields;
    notify('error', errorMessage(e, `${props.entity} ${t('crud.failed')}`));
  } finally {
    saving.value = false;
  }
}

// ---------------------------------------------------------------- hapus
const deleteOpen = ref(false);
const deleting = ref(false);
const toDelete = ref<T | null>(null);

function askDelete(row: T) {
  toDelete.value = row;
  deleteOpen.value = true;
}
async function confirmDelete() {
  if (!toDelete.value) return;
  deleting.value = true;
  try {
    await props.remove?.(toDelete.value);
    deleteOpen.value = false;
    notify('success', `${props.entity} ${t('crud.success')} ${t('crud.deleted')}`);
    emit('deleted', [toDelete.value]);
    await tableRef.value?.refresh();
  } catch (e) {
    notify('error', errorMessage(e, `${props.entity} ${t('crud.failed')}`));
  } finally {
    deleting.value = false;
  }
}

async function bulkDelete(rows: T[]) {
  await props.removeMany!(rows);
  emit('deleted', rows);
}

// ---------------------------------------------------------------- form manual (#form)
function setValue(name: string, value: unknown) {
  values.value = { ...values.value, [name]: value };
  if (name in errors.value) {
    const { [name]: _, ...rest } = errors.value;
    errors.value = rest;
  }
}
async function submitManual() {
  const errs = await validateFields(activeFields.value, values.value, t, props.schema);
  errors.value = errs;
  if (!Object.keys(errs).length) await save({ ...values.value });
}
function submitForm() {
  if (slots.form) void submitManual();
  else formRef.value?.submit();
}

// ---------------------------------------------------------------- event & form halaman penuh
const rootEl = ref<HTMLElement>();
watch(formOpen, (open) => {
  if (open) emit('form-open', mode.value, current.value);
  else emit('form-close', mode.value);
});
/** Tutup form; di mode halaman penuh gulir kembali ke tabel (kecuali tombol ×). */
async function closeForm(scroll = true) {
  formOpen.value = false;
  if (props.formPage && scroll) {
    await nextTick();
    rootEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

const canEdit = computed(() => !!props.update);
defineExpose({ openCreate, openEdit, closeForm, refresh: () => tableRef.value?.refresh() });
</script>

<template>
  <div ref="rootEl" class="h-0" aria-hidden="true" />
  <MrcDataTable
    v-show="!(formPage && formOpen)"
    ref="tableRef"
    v-bind="attrs as any"
    :on-create="create ? openCreate : undefined"
    :on-edit="canEdit ? openEdit : undefined"
    :on-delete="remove ? askDelete : undefined"
    :on-bulk-delete="removeMany ? bulkDelete : undefined"
    :entity="entity"
    :selectable="(attrs.selectable as any) ?? !!removeMany"
  >
    <template v-for="slot in tableSlots" #[slot]="scope">
      <slot :name="slot" v-bind="scope ?? {}" />
    </template>
  </MrcDataTable>

  <component
    :is="formPage ? MrcFormPageShell : MrcModal"
    v-model:open="formOpen"
    :title="title"
    :icon="mode === 'edit' ? 'edit_note' : 'add_circle'"
    v-bind="
      formPage
        ? { card: formPageCard, border: formPageBorder, onDismiss: () => closeForm(false) }
        : { size: formSize, dismissible: formDismissible && !saving }
    "
  >
    <div v-if="preparing" class="flex justify-center py-10"><span class="loading loading-spinner" /></div>
    <form v-else-if="$slots.form" novalidate @submit.prevent="submitManual">
      <slot name="form" :values="values" :errors="errors" :set="setValue" :mode="mode" :row="(current as T | null)" :saving="saving" :submit="submitManual" />
      <p v-if="errors._form" class="text-error mt-2 text-sm" role="alert">{{ errors._form }}</p>
      <button type="submit" class="hidden" tabindex="-1" aria-hidden="true" />
    </form>
    <MrcForm
      v-else
      ref="formRef"
      v-model="values"
      v-model:errors="errors"
      :fields="activeFields"
      :schema="schema"
      :readonly="saving"
      :gap="formGap"
      :column-gap="formColumnGap"
      @submit="save"
    >
      <template v-for="f in activeFields.filter((x) => x.type === 'slot')" :key="f.name" #[`field-${f.name}`]="scope">
        <slot :name="`field-${f.name}`" v-bind="scope" />
      </template>
    </MrcForm>
    <template #footer>
      <button type="button" class="btn btn-primary gap-2 px-6 shadow-sm" :disabled="saving || preparing" @click="submitForm">
        <span v-if="saving" class="loading loading-spinner loading-xs" />
        <MrcIcon v-else name="check_circle" />
        {{ t('action.save') }}
      </button>
      <button type="button" class="btn btn-ghost" :disabled="saving" @click="closeForm()">{{ t('action.cancel') }}</button>
    </template>
  </component>

  <MrcConfirm
    v-model:open="deleteOpen"
    variant="large"
    :title="t('confirm.deleteTitle')"
    :description="t('confirm.deleteText')"
    :detail="toDelete && deleteLabel ? deleteLabel(toDelete) : undefined"
    :loading="deleting"
    :dismissible="deleteDismissible"
    @confirm="confirmDelete"
  />
</template>
