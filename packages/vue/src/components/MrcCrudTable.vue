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
 */
import { computed, ref, useAttrs } from 'vue';
import { useMrcatz } from '../config';
import { initialValues, type CrudMode, type FieldDef, type FormValues } from '../fields';
import { errorMessage, MrcFormError, type FormErrors, type StandardSchema } from '../validation';
import MrcDataTable from './MrcDataTable.vue';
import MrcModal from './MrcModal.vue';
import MrcConfirm from './MrcConfirm.vue';
import MrcIcon from './MrcIcon.vue';
import MrcForm from './form/MrcForm.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    /** Nama entitas untuk judul form & notifikasi, mis. "Pengguna". */
    entity: string;
    fields: FieldDef[] | ((ctx: { mode: CrudMode; row: T | null }) => FieldDef[]);
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
  }>(),
  { formSize: 'lg', formDismissible: false },
);
const emit = defineEmits<{ saved: [mode: CrudMode, values: FormValues, result: unknown]; deleted: [rows: T[]] }>();
const attrs = useAttrs();
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
  typeof props.fields === 'function' ? props.fields({ mode: mode.value, row: current.value }) : props.fields,
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
    formOpen.value = false;
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

const canEdit = computed(() => !!props.update);
defineExpose({ openCreate, openEdit, refresh: () => tableRef.value?.refresh() });
</script>

<template>
  <MrcDataTable
    ref="tableRef"
    v-bind="attrs as any"
    :on-create="create ? openCreate : undefined"
    :on-edit="canEdit ? openEdit : undefined"
    :on-delete="remove ? askDelete : undefined"
    :on-bulk-delete="removeMany ? bulkDelete : undefined"
    :entity="entity"
    :selectable="(attrs.selectable as any) ?? !!removeMany"
  >
    <template v-for="(_, slot) in $slots" #[slot]="scope">
      <slot :name="slot" v-bind="scope ?? {}" />
    </template>
  </MrcDataTable>

  <MrcModal
    v-model:open="formOpen"
    :title="title"
    :icon="mode === 'edit' ? 'edit_note' : 'add_circle'"
    :size="formSize"
    :dismissible="formDismissible && !saving"
  >
    <div v-if="preparing" class="flex justify-center py-10"><span class="loading loading-spinner" /></div>
    <MrcForm
      v-else
      ref="formRef"
      v-model="values"
      v-model:errors="errors"
      :fields="activeFields"
      :schema="schema"
      :readonly="saving"
      @submit="save"
    >
      <template v-for="f in activeFields.filter((x) => x.type === 'slot')" :key="f.name" #[`field-${f.name}`]="scope">
        <slot :name="`field-${f.name}`" v-bind="scope" />
      </template>
    </MrcForm>
    <template #footer>
      <button type="button" class="btn btn-primary gap-2 px-6 shadow-sm" :disabled="saving || preparing" @click="formRef?.submit()">
        <span v-if="saving" class="loading loading-spinner loading-xs" />
        <MrcIcon v-else name="check_circle" />
        {{ t('action.save') }}
      </button>
      <button type="button" class="btn btn-ghost" :disabled="saving" @click="formOpen = false">{{ t('action.cancel') }}</button>
    </template>
  </MrcModal>

  <MrcConfirm
    v-model:open="deleteOpen"
    variant="large"
    :title="t('confirm.deleteTitle')"
    :description="t('confirm.deleteText')"
    :detail="toDelete && deleteLabel ? deleteLabel(toDelete) : undefined"
    :loading="deleting"
    @confirm="confirmDelete"
  />
</template>
