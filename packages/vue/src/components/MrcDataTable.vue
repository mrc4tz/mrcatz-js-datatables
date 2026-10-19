<script setup lang="ts" generic="T extends Record<string, any>">
/**
 * DataTable lengkap (pengganti `MrCatzDataTablesComponent` + view `datatable-js`).
 *
 * Handler asinkron dipasang sebagai listener biasa — tabel menunggu
 * hasilnya (loading, konfirmasi, refresh otomatis):
 *
 * <MrcDataTable
 *   name="pengguna" title="Pengguna"
 *   :source="source" :columns="columns"
 *   @create="openForm()" @edit="openForm" @delete="confirmDelete"
 *   @cell-update="(row, key, value) => api.patch(row.id, { [key]: value })"
 *   @bulk-delete="(rows) => api.removeMany(rows.map(r => r.id))"
 * />
 */
import { computed, nextTick, ref, useSlots, watch } from 'vue';
import type { FilterSchema, SortRule } from '@mrcatz/datatable-core';
import { useMrcatz } from '../config';
import { allowed, cellValue, TONE_BTN, type CellContext, type ColumnDef } from '../columns';
import type { DataSource } from '../sources';
import type { BulkAction } from '../bulk';
import type { ExpandField } from '../expand';
import type { ExportFormat } from '../export';
import type { FormValues } from '../fields';
import { initialValues } from '../fields';
import { errorMessage, MrcFormError, type FormErrors } from '../validation';
import { useDataTable, type PaginationMode, type RowKey } from '../composables/useDataTable';
import MrcIcon from './MrcIcon.vue';
import MrcConfirm from './MrcConfirm.vue';
import MrcModal from './MrcModal.vue';
import MrcExpandFields from './MrcExpandFields.vue';
import MrcForm from './form/MrcForm.vue';
import FilterPanel from './filters/FilterPanel.vue';
import ActiveFilters from './filters/ActiveFilters.vue';
import ColumnMenu from './table/ColumnMenu.vue';
import TablePagination from './table/TablePagination.vue';
import TableCell from './table/TableCell.vue';
import InlineEditor from './table/InlineEditor.vue';
import ExportModal from './table/ExportModal.vue';

const props = withDefaults(
  defineProps<{
    source: DataSource<T>;
    columns: ColumnDef<T>[];
    /** Namespace URL/cache/preset — wajib unik bila ada >1 tabel di halaman. */
    name?: string;
    title?: string;
    description?: string;

    searchable?: boolean;
    /** `live`: cari saat mengetik (debounce); `submit`: tekan Enter. */
    searchMode?: 'live' | 'submit';
    searchDebounce?: number;
    searchPlaceholder?: string;

    perPageOptions?: number[];
    defaultSort?: SortRule[];
    /** Schema filter statis (bila sumber tidak menyediakan `schema`). */
    filters?: FilterSchema[];
    pagination?: PaginationMode;
    syncUrl?: boolean;
    rowKey?: RowKey<T>;

    /** Kotak centang per baris; fungsi untuk menentukan baris mana yang bisa dipilih. */
    selectable?: boolean | ((row: T) => boolean);
    /**
     * Tampilkan tombol "Pilih" untuk menyalakan/mematikan mode seleksi
     * (pengganti `$showBulkButton`). Kotak centang hanya muncul saat mode aktif;
     * mematikannya mengosongkan seleksi. Default `false` = kotak centang selalu tampil.
     */
    selectionToggle?: boolean;
    bulkActions?: BulkAction<T>[];
    /** Baris bisa dibuka: `true`/`both`, atau hanya `desktop`/`mobile`. */
    expandable?: boolean | 'both' | 'desktop' | 'mobile';
    /** Isi expand otomatis; alternatifnya slot `#expand`. */
    expandFields?: ExpandField[] | ((row: T) => ExpandField[] | null);

    card?: boolean;
    bordered?: boolean;
    zebra?: boolean;
    stickyHeader?: boolean;
    /** Tampilan kartu di layar kecil. */
    mobileCards?: boolean;
    columnVisibility?: boolean;
    columnReorder?: boolean;
    columnResize?: boolean;
    sorting?: boolean;
    keyboardNav?: boolean;
    showKeyboardHint?: boolean;
    exportable?: boolean | { formats?: ExportFormat[]; filename?: string };
    presets?: boolean;
    /** Tampilkan tombol Tambah. Default: otomatis bila ada listener `@create`. */
    creatable?: boolean;
    createLabel?: string;

    // Handler (dipasang via @event; boleh async)
    onCreate?: () => void;
    onEdit?: (row: T) => void;
    onDelete?: (row: T) => void;
    onRowClick?: (row: T) => void;
    onCellUpdate?: (row: T, key: string, value: string) => unknown;
    onBulkDelete?: (rows: T[]) => unknown;
    onBulkAction?: (action: BulkAction<T>, rows: T[], values: FormValues) => unknown;
  }>(),
  {
    searchable: true,
    searchMode: 'live',
    searchDebounce: 400,
    pagination: 'pages',
    syncUrl: true,
    selectable: false,
    expandable: false,
    card: true,
    bordered: false,
    zebra: true,
    stickyHeader: false,
    mobileCards: true,
    columnVisibility: true,
    columnReorder: true,
    columnResize: true,
    sorting: true,
    keyboardNav: true,
    showKeyboardHint: false,
    exportable: true,
    presets: true,
    creatable: undefined,
  },
);

const emit = defineEmits<{ 'selection-change': [rows: T[]] }>();
/** Mode seleksi (hanya berpengaruh bila `selectionToggle`). Bisa dikontrol lewat `v-model:selection-mode`. */
const selectionMode = defineModel<boolean>('selectionMode', { default: false });
const slots = useSlots();
const { t, notify } = useMrcatz();

const table = useDataTable<T>({
  source: () => props.source,
  columns: () => props.columns,
  name: props.name,
  perPageOptions: props.perPageOptions,
  defaultSort: props.defaultSort,
  filters: () => props.filters,
  pagination: props.pagination,
  syncUrl: props.syncUrl,
  rowKey: props.rowKey,
});
const { state, meta, rows } = table;

watch(table.selectedRows, (r) => emit('selection-change', r));

// ---------------------------------------------------------------- search
let searchTimer: ReturnType<typeof setTimeout> | undefined;
function onSearchInput(v: string) {
  table.searchInput.value = v;
  if (props.searchMode !== 'live') return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => table.applySearch(), props.searchDebounce);
}

// ---------------------------------------------------------------- columns & responsive
const desktopColumns = computed(() => table.visibleColumns.value.filter((c) => c.showOn !== 'mobile'));
const mobileColumns = computed(() => table.visibleColumns.value.filter((c) => c.showOn !== 'desktop' && c.kind !== 'actions'));
const actionColumn = computed(() => table.visibleColumns.value.find((c) => c.kind === 'actions'));
const mobileTitleColumn = computed(() => mobileColumns.value.find((c) => c.rowHeader) ?? mobileColumns.value.find((c) => c.kind === 'data'));

const canSelect = (row: T) => (typeof props.selectable === 'function' ? props.selectable(row) : !!props.selectable);
const selectionEnabled = computed(() => !!props.selectable && (!props.selectionToggle || selectionMode.value));
function toggleSelectionMode() {
  selectionMode.value = !selectionMode.value;
}
// Mematikan mode seleksi mengosongkan pilihan (setara `toggleBulk()` versi Laravel).
watch(selectionEnabled, (on) => {
  if (!on) table.clearSelection();
});
const pageSelectable = computed(() => rows.value.filter(canSelect));
const pageAllSelected = computed(() => pageSelectable.value.length > 0 && pageSelectable.value.every(table.isSelected));
const pageSomeSelected = computed(() => !pageAllSelected.value && pageSelectable.value.some(table.isSelected));

const expandOn = computed(() => (props.expandable === true ? 'both' : props.expandable || null));
const expanded = ref(new Set<string>());
function expandContent(row: T): ExpandField[] | null {
  const f = props.expandFields;
  return typeof f === 'function' ? f(row) : (f ?? null);
}
const hasExpand = (row: T) => !!slots.expand || !!expandContent(row);
function toggleExpand(row: T) {
  const k = table.keyOf(row);
  const next = new Set(expanded.value);
  next.has(k) ? next.delete(k) : next.add(k);
  expanded.value = next;
}

const showCreate = computed(() => props.creatable ?? !!props.onCreate);
const exportOpts = computed(() => (typeof props.exportable === 'object' ? props.exportable : {}));

const ctxOf = (index: number): CellContext => ({
  index,
  number: props.pagination === 'pages' ? (meta.value.page - 1) * meta.value.limit + index + 1 : index + 1,
  search: state.search,
});

const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;
const colStyle = (c: ColumnDef<T>) => {
  const w = state.widths[c.id] ?? c.width;
  return w ? { width: `${w}px`, minWidth: `${w}px` } : undefined;
};

// ---------------------------------------------------------------- sorting & resize
function onHeaderClick(c: ColumnDef<T>, e: MouseEvent) {
  if (!props.sorting || !c.sortable) return;
  table.toggleSort(c.sortKey ?? c.key!, e.shiftKey);
}
function ariaSort(c: ColumnDef<T>) {
  const s = table.sortOf(c.sortKey ?? c.key ?? '');
  return s ? (s.dir === 'asc' ? 'ascending' : 'descending') : 'none';
}
function startResize(c: ColumnDef<T>, e: PointerEvent) {
  const th = (e.target as HTMLElement).closest('th');
  if (!th) return;
  const startX = e.clientX;
  const startW = th.getBoundingClientRect().width;
  const move = (ev: PointerEvent) => table.setWidth(c.id, startW + ev.clientX - startX);
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

// ---------------------------------------------------------------- inline edit
const editing = ref<{ key: string; col: string } | null>(null);
const editSaving = ref(false);
const editError = ref<string | null>(null);

function canInlineEdit(c: ColumnDef<T>, row: T) {
  return !!props.onCellUpdate && !!c.editable && !!c.key && allowed(c.editable.when, row);
}
function startEdit(c: ColumnDef<T>, row: T) {
  if (!canInlineEdit(c, row)) return;
  editing.value = { key: table.keyOf(row), col: c.id };
  editError.value = null;
}
function isEditing(c: ColumnDef<T>, row: T) {
  return editing.value?.col === c.id && editing.value.key === table.keyOf(row);
}
async function saveEdit(c: ColumnDef<T>, row: T, value: string) {
  if (!c.editable || !c.key) return;
  if (String(cellValue(c, row) ?? '') === value) return (editing.value = null);
  const invalid = c.editable.validate?.(value, row);
  if (typeof invalid === 'string') return (editError.value = invalid);
  editSaving.value = true;
  try {
    await props.onCellUpdate!(row, c.key, value);
    editing.value = null;
    notify('success', t('crud.saved'));
    await table.refresh();
  } catch (e) {
    editError.value = errorMessage(e, t('crud.failed'));
  } finally {
    editSaving.value = false;
  }
}
function cancelEdit() {
  if (!editSaving.value) editing.value = null;
}

// ---------------------------------------------------------------- bulk
const bulkDeleteOpen = ref(false);
const bulkBusy = ref(false);
const activeBulk = ref<BulkAction<T> | null>(null);
const bulkConfirmOpen = ref(false);
const bulkFormOpen = ref(false);
const bulkValues = ref<FormValues>({});
const bulkErrors = ref<FormErrors>({});
const bulkForm = ref<InstanceType<typeof MrcForm>>();

const visibleBulkActions = computed(() =>
  (props.bulkActions ?? []).filter((a) => !a.when || a.when(table.selectedRows.value)),
);

async function runBulkDelete() {
  bulkBusy.value = true;
  try {
    const count = table.selectedRows.value.length;
    await props.onBulkDelete!(table.selectedRows.value);
    bulkDeleteOpen.value = false;
    table.clearSelection();
    notify('success', t('crud.bulkDeleted', { count, entity: props.title ?? '' }).trim());
    await table.refresh();
  } catch (e) {
    notify('error', errorMessage(e, t('crud.failed')));
  } finally {
    bulkBusy.value = false;
  }
}

function openBulk(action: BulkAction<T>) {
  activeBulk.value = action;
  if (action.mode === 'instant') return void runBulk({});
  if (action.mode === 'form') {
    bulkValues.value = initialValues(action.fields ?? []);
    bulkErrors.value = {};
    bulkFormOpen.value = true;
  } else bulkConfirmOpen.value = true;
}

async function runBulk(values: FormValues) {
  const action = activeBulk.value;
  if (!action || !props.onBulkAction) return;
  bulkBusy.value = true;
  try {
    await props.onBulkAction(action, table.selectedRows.value, values);
    bulkConfirmOpen.value = bulkFormOpen.value = false;
    table.clearSelection();
    await table.refresh();
  } catch (e) {
    if (e instanceof MrcFormError) bulkErrors.value = e.fields;
    notify('error', errorMessage(e, t('crud.failed')));
  } finally {
    bulkBusy.value = false;
  }
}

// ---------------------------------------------------------------- toolbar
const filterOpen = ref(false);
const resetOpen = ref(false);
const exportOpen = ref(false);
const visibleFilterCount = computed(() => table.filters.value.filter((f) => f.visible).length);

function doReset() {
  table.reset();
  expanded.value = new Set();
  resetOpen.value = false;
}

// ---------------------------------------------------------------- keyboard
const focused = ref(-1);
const bodyEl = ref<HTMLElement>();
watch(rows, () => (focused.value = -1));

function onKeydown(e: KeyboardEvent) {
  if (!props.keyboardNav || editing.value) return;
  const target = e.target as HTMLElement;
  if (target.closest('input,textarea,select,button,a,[contenteditable]') && target !== bodyEl.value) return;
  const row = rows.value[focused.value];
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      focused.value = Math.min(focused.value + 1, rows.value.length - 1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      focused.value = Math.max(focused.value - 1, 0);
      break;
    case 'Enter':
      if (row && actionColumn.value && allowed(actionColumn.value.actions?.edit, row) && props.onEdit) props.onEdit(row);
      else if (row && props.onRowClick) props.onRowClick(row);
      break;
    case 'Delete':
    case 'Backspace':
      if (row && actionColumn.value && allowed(actionColumn.value.actions?.delete, row) && props.onDelete) props.onDelete(row);
      break;
    case ' ':
      if (row && selectionEnabled.value && canSelect(row)) {
        e.preventDefault();
        table.toggleRow(row);
      }
      break;
    case 'Escape':
      focused.value = -1;
      break;
    default:
      return;
  }
  void nextTick(() => bodyEl.value?.querySelector<HTMLElement>(`[data-row="${focused.value}"]`)?.scrollIntoView({ block: 'nearest' }));
}

function handleRowClick(row: T, index: number) {
  focused.value = index;
  props.onRowClick?.(row);
}

const isEmpty = computed(() => !table.isLoading.value && rows.value.length === 0);
const desktopColspan = computed(
  () => desktopColumns.value.length + (selectionEnabled.value ? 1 : 0) + (expandOn.value && expandOn.value !== 'mobile' ? 1 : 0),
);

defineExpose({ table, refresh: table.refresh, reset: table.reset, clearSelection: table.clearSelection });
</script>

<template>
  <section
    class="mrc-datatable flex flex-col gap-3"
    :class="[card && 'card bg-base-100 p-4 shadow-sm sm:p-5', bordered && 'border-base-content/10 border']"
  >
    <!-- Header -->
    <header v-if="title || $slots.title || $slots.actions" class="flex flex-wrap items-start justify-between gap-2">
      <slot name="title">
        <div class="min-w-0">
          <h2 v-if="title" class="text-lg font-semibold">{{ title }}</h2>
          <p v-if="description" class="text-base-content/60 text-sm">{{ description }}</p>
        </div>
      </slot>
      <div class="flex items-center gap-2"><slot name="actions" /></div>
    </header>

    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-2">
      <form v-if="searchable" class="min-w-48 flex-1 sm:max-w-sm" role="search" @submit.prevent="table.applySearch()">
        <label class="input input-sm focus-within:input-primary w-full">
          <MrcIcon name="search" :size="15" class="opacity-50" />
          <input
            type="search"
            class="grow"
            :value="table.searchInput.value"
            :placeholder="searchPlaceholder ?? t('search.placeholder')"
            :aria-label="t('search.submit')"
            @input="onSearchInput(($event.target as HTMLInputElement).value)"
          />
          <span v-if="table.isFetching.value && state.search" class="loading loading-spinner loading-xs opacity-60" />
          <kbd v-else-if="searchMode === 'submit'" class="kbd kbd-xs">⏎</kbd>
        </label>
      </form>

      <div class="ml-auto flex flex-wrap items-center gap-1.5">
        <slot name="toolbar" :table="table" />

        <button
          v-if="visibleFilterCount || presets"
          type="button"
          class="btn btn-sm gap-1.5"
          :class="filterOpen || table.activeFilterCount.value ? 'btn-primary btn-soft' : 'btn-ghost border-base-content/15 border'"
          :aria-expanded="filterOpen"
          @click="filterOpen = !filterOpen"
        >
          <MrcIcon name="filter" :size="15" />
          <span class="hidden sm:inline">{{ t('filter.button') }}</span>
          <span v-if="table.activeFilterCount.value" class="badge badge-xs badge-primary">{{ table.activeFilterCount.value }}</span>
        </button>

        <button
          v-if="selectable && selectionToggle"
          type="button"
          class="btn btn-sm btn-square"
          :class="selectionMode ? 'btn-secondary' : 'btn-ghost border-base-content/15 border'"
          :title="t('action.select')"
          :aria-label="t('action.select')"
          :aria-pressed="selectionMode"
          @click="toggleSelectionMode"
        >
          <MrcIcon :name="selectionMode ? 'check-square' : 'square'" :size="15" />
        </button>

        <ColumnMenu v-if="columnVisibility" :table="table" :reorder="columnReorder" />

        <button
          v-if="exportable"
          type="button"
          class="btn btn-ghost btn-sm btn-square border-base-content/15 border"
          :title="t('action.export')"
          :aria-label="t('action.export')"
          @click="exportOpen = true"
        >
          <MrcIcon name="download" :size="15" />
        </button>

        <button
          type="button"
          class="btn btn-ghost btn-sm btn-square border-base-content/15 border"
          :title="t('action.refresh')"
          :aria-label="t('action.refresh')"
          @click="table.refresh()"
        >
          <MrcIcon name="refresh" :size="15" :class="{ 'animate-spin': table.isFetching.value }" />
        </button>

        <button
          v-if="table.isDirty.value"
          type="button"
          class="btn btn-ghost btn-sm btn-square border-base-content/15 border"
          :title="t('action.reset')"
          :aria-label="t('action.reset')"
          @click="resetOpen = true"
        >
          <MrcIcon name="reset" :size="15" />
        </button>

        <button v-if="showCreate" type="button" class="btn btn-primary btn-sm gap-1.5" @click="onCreate?.()">
          <MrcIcon name="plus" :size="15" />
          {{ createLabel ?? t('action.add') }}
        </button>
      </div>
    </div>

    <FilterPanel v-if="filterOpen" :table="table" :presets="presets" />
    <ActiveFilters v-else :table="table" />

    <!-- Bulk bar -->
    <Transition enter-active-class="transition duration-150" enter-from-class="opacity-0 -translate-y-1">
      <div
        v-if="table.selectedRows.value.length"
        class="bg-primary/8 border-primary/20 flex flex-wrap items-center gap-2 rounded-field border px-3 py-2 text-sm"
      >
        <MrcIcon name="check-square" :size="16" class="text-primary" />
        <span class="font-medium">{{ t('bulk.selected', { count: table.selectedRows.value.length }) }}</span>
        <button type="button" class="link link-hover text-xs" @click="table.clearSelection()">{{ t('bulk.clear') }}</button>
        <div class="ml-auto flex flex-wrap gap-1.5">
          <slot name="bulk" :rows="table.selectedRows.value" />
          <button
            v-for="a in visibleBulkActions"
            :key="a.id"
            type="button"
            class="btn btn-xs"
            :class="[TONE_BTN[a.tone ?? 'primary'], 'btn-soft']"
            @click="openBulk(a)"
          >
            <MrcIcon v-if="a.icon" :name="a.icon" :size="13" />
            {{ a.label }}
          </button>
          <button v-if="onBulkDelete" type="button" class="btn btn-error btn-soft btn-xs" @click="bulkDeleteOpen = true">
            <MrcIcon name="trash" :size="13" />
            {{ t('action.delete') }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- Error -->
    <div v-if="table.error.value && !rows.length" role="alert" class="alert alert-error alert-soft">
      <MrcIcon name="alert" />
      <span>{{ t('error') }}: {{ errorMessage(table.error.value, '') }}</span>
      <button type="button" class="btn btn-sm" @click="table.refresh()">{{ t('retry') }}</button>
    </div>

    <!-- Tabel desktop -->
    <div
      ref="bodyEl"
      class="border-base-content/10 relative overflow-x-auto rounded-box border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      :class="[mobileCards && 'hidden md:block', stickyHeader && 'max-h-[70vh] overflow-y-auto']"
      :tabindex="keyboardNav ? 0 : undefined"
      @keydown="onKeydown"
    >
      <div v-if="table.isFetching.value && rows.length" class="bg-primary/60 absolute inset-x-0 top-0 z-20 h-0.5 animate-pulse" />
      <table class="table table-sm" :class="{ 'table-zebra': zebra, 'table-pin-rows': stickyHeader }">
        <thead>
          <tr class="bg-base-200/50">
            <th v-if="expandOn && expandOn !== 'mobile'" class="w-8" />
            <th v-if="selectionEnabled" class="w-10">
              <input
                type="checkbox"
                class="checkbox checkbox-sm checkbox-primary"
                :checked="pageAllSelected"
                :indeterminate="pageSomeSelected"
                :disabled="!pageSelectable.length"
                :aria-label="t('bulk.selectPage')"
                @change="table.togglePage(canSelect)"
              />
            </th>
            <th
              v-for="c in desktopColumns"
              :key="c.id"
              class="group relative whitespace-nowrap select-none"
              :class="[alignClass[c.align], c.sortable && sorting && 'hover:bg-base-200 cursor-pointer']"
              :style="colStyle(c)"
              :aria-sort="c.sortable && sorting ? ariaSort(c) : undefined"
              @click="onHeaderClick(c, $event)"
            >
              <span class="inline-flex items-center gap-1" :class="c.align === 'right' && 'flex-row-reverse'">
                <slot :name="`header-${c.id}`" :column="c">{{ c.label || (c.kind === 'actions' ? t('column.actions') : '') }}</slot>
                <template v-if="c.sortable && sorting">
                  <template v-if="table.sortOf(c.sortKey ?? c.key!)">
                    <MrcIcon :name="table.sortOf(c.sortKey ?? c.key!)!.dir === 'asc' ? 'arrow-up' : 'arrow-down'" :size="13" class="text-primary" />
                    <sup v-if="table.sortOf(c.sortKey ?? c.key!)!.priority" class="text-primary text-[10px]">{{ table.sortOf(c.sortKey ?? c.key!)!.priority }}</sup>
                  </template>
                  <MrcIcon v-else name="arrow-up-down" :size="13" class="opacity-0 transition group-hover:opacity-40" />
                </template>
              </span>
              <span
                v-if="columnResize && c.kind !== 'actions'"
                class="hover:bg-primary/40 absolute top-0 right-0 h-full w-1.5 cursor-col-resize"
                @pointerdown.stop.prevent="startResize(c, $event)"
                @click.stop
              />
            </th>
          </tr>
        </thead>

        <tbody>
          <!-- Loading awal: skeleton -->
          <template v-if="table.isLoading.value">
            <tr v-for="i in Math.min(state.limit, 6)" :key="`sk-${i}`">
              <td v-for="j in desktopColspan" :key="j"><div class="skeleton h-4 w-full max-w-40" /></td>
            </tr>
          </template>

          <template v-for="(row, i) in rows" :key="table.keyOf(row)">
            <tr
              :data-row="i"
              class="transition-colors"
              :class="[
                (props.onRowClick || (expandOn && expandOn !== 'mobile' && hasExpand(row))) && 'cursor-pointer',
                table.isSelected(row) && 'bg-primary/5',
                focused === i && 'outline-primary/50 outline-2 -outline-offset-2',
                'hover:bg-base-200/60',
              ]"
              @click="handleRowClick(row, i)"
            >
              <td v-if="expandOn && expandOn !== 'mobile'" class="w-8 px-1">
                <button
                  v-if="hasExpand(row)"
                  type="button"
                  class="btn btn-ghost btn-xs btn-square"
                  :aria-expanded="expanded.has(table.keyOf(row))"
                  :aria-label="t('action.details')"
                  @click.stop="toggleExpand(row)"
                >
                  <MrcIcon name="chevron-right" :size="14" class="transition-transform" :class="{ 'rotate-90': expanded.has(table.keyOf(row)) }" />
                </button>
              </td>
              <td v-if="selectionEnabled" class="w-10" @click.stop>
                <input
                  v-if="canSelect(row)"
                  type="checkbox"
                  class="checkbox checkbox-sm checkbox-primary"
                  :checked="table.isSelected(row)"
                  :aria-label="t('bulk.selectRow')"
                  @change="table.toggleRow(row)"
                />
              </td>
              <component
                :is="c.rowHeader ? 'th' : 'td'"
                v-for="c in desktopColumns"
                :key="c.id"
                :scope="c.rowHeader ? 'row' : undefined"
                :class="[alignClass[c.align], c.class, c.rowHeader && 'font-semibold', canInlineEdit(c, row) && 'cursor-text']"
                :style="colStyle(c)"
                :title="canInlineEdit(c, row) && !isEditing(c, row) ? t('inline.hint') : undefined"
                @dblclick.stop="startEdit(c, row)"
              >
                <InlineEditor
                  v-if="isEditing(c, row) && c.editable"
                  :config="c.editable"
                  :initial="cellValue(c, row)"
                  :error="editError"
                  :saving="editSaving"
                  @save="saveEdit(c, row, $event)"
                  @cancel="cancelEdit"
                />
                <slot v-else-if="$slots[`cell-${c.id}`]" :name="`cell-${c.id}`" :row="row" :value="cellValue(c, row)" v-bind="ctxOf(i)" />
                <TableCell v-else :column="c" :row="row" :ctx="ctxOf(i)" @edit="onEdit?.(row)" @delete="onDelete?.(row)" />
              </component>
            </tr>
            <tr v-if="expanded.has(table.keyOf(row))" class="bg-base-200/30">
              <td :colspan="desktopColspan" class="px-6 py-4">
                <slot name="expand" :row="row">
                  <MrcExpandFields v-if="expandContent(row)" :row="row" :fields="expandContent(row)!" />
                </slot>
              </td>
            </tr>
          </template>

          <tr v-if="isEmpty && !table.error.value">
            <td :colspan="desktopColspan">
              <slot name="empty" :search="state.search" :filtered="table.activeFilterCount.value > 0">
                <div class="flex flex-col items-center gap-1 py-10 text-center">
                  <MrcIcon :name="state.search || table.activeFilterCount.value ? 'search-x' : 'inbox'" :size="36" class="text-base-content/25 mb-1" />
                  <p class="font-medium">
                    {{ state.search ? t('empty.searchTitle', { query: state.search }) : table.activeFilterCount.value ? t('empty.title') : t('empty.noData') }}
                  </p>
                  <p class="text-base-content/60 text-sm">
                    {{ state.search ? t('empty.searchHint') : table.activeFilterCount.value ? t('empty.filterHint') : t('empty.noDataHint') }}
                  </p>
                  <button v-if="table.isDirty.value" type="button" class="btn btn-ghost btn-sm mt-2" @click="doReset">{{ t('action.reset') }}</button>
                </div>
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Kartu mobile -->
    <div v-if="mobileCards" class="flex flex-col gap-2 md:hidden">
      <div v-if="selectionEnabled && rows.length" class="flex items-center gap-2 px-1 text-sm">
        <input
          type="checkbox"
          class="checkbox checkbox-sm checkbox-primary"
          :checked="pageAllSelected"
          :indeterminate="pageSomeSelected"
          :aria-label="t('bulk.selectPage')"
          @change="table.togglePage(canSelect)"
        />
        <span class="text-base-content/60">{{ t('bulk.selectPage') }}</span>
      </div>
      <template v-if="table.isLoading.value">
        <div v-for="i in 3" :key="i" class="skeleton h-24 w-full" />
      </template>
      <article
        v-for="(row, i) in rows"
        :key="table.keyOf(row)"
        class="border-base-content/10 bg-base-100 rounded-box border p-3"
        :class="{ 'border-primary/40 bg-primary/5': table.isSelected(row) }"
        @click="handleRowClick(row, i)"
      >
        <div class="flex items-start gap-2">
          <input
            v-if="selectionEnabled && canSelect(row)"
            type="checkbox"
            class="checkbox checkbox-sm checkbox-primary mt-0.5"
            :checked="table.isSelected(row)"
            :aria-label="t('bulk.selectRow')"
            @click.stop
            @change="table.toggleRow(row)"
          />
          <div class="min-w-0 flex-1">
            <div v-if="mobileTitleColumn" class="font-semibold">
              <slot v-if="$slots[`cell-${mobileTitleColumn.id}`]" :name="`cell-${mobileTitleColumn.id}`" :row="row" :value="cellValue(mobileTitleColumn, row)" v-bind="ctxOf(i)" />
              <TableCell v-else :column="mobileTitleColumn" :row="row" :ctx="ctxOf(i)" />
            </div>
            <dl class="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <template v-for="c in mobileColumns" :key="c.id">
                <template v-if="c !== mobileTitleColumn && c.kind !== 'rowNumber'">
                  <dt class="text-base-content/60">{{ c.label }}</dt>
                  <dd class="min-w-0 break-words" @click="canInlineEdit(c, row) && ($event.stopPropagation(), startEdit(c, row))">
                    <InlineEditor
                      v-if="isEditing(c, row) && c.editable"
                      :config="c.editable"
                      :initial="cellValue(c, row)"
                      :error="editError"
                      :saving="editSaving"
                      @save="saveEdit(c, row, $event)"
                      @cancel="cancelEdit"
                    />
                    <slot v-else-if="$slots[`cell-${c.id}`]" :name="`cell-${c.id}`" :row="row" :value="cellValue(c, row)" v-bind="ctxOf(i)" />
                    <TableCell v-else :column="c" :row="row" :ctx="ctxOf(i)" />
                  </dd>
                </template>
              </template>
            </dl>
          </div>
          <TableCell v-if="actionColumn" :column="actionColumn" :row="row" :ctx="ctxOf(i)" @edit="onEdit?.(row)" @delete="onDelete?.(row)" />
        </div>
        <template v-if="expandOn && expandOn !== 'desktop' && hasExpand(row)">
          <button type="button" class="btn btn-ghost btn-xs mt-2 w-full" @click.stop="toggleExpand(row)">
            {{ t('action.details') }}
            <MrcIcon name="chevron-down" :size="13" class="transition-transform" :class="{ 'rotate-180': expanded.has(table.keyOf(row)) }" />
          </button>
          <div v-if="expanded.has(table.keyOf(row))" class="border-base-content/10 mt-2 border-t pt-2">
            <slot name="expand" :row="row">
              <MrcExpandFields v-if="expandContent(row)" :row="row" :fields="expandContent(row)!" />
            </slot>
          </div>
        </template>
      </article>
      <div v-if="isEmpty && !table.error.value" class="text-base-content/60 py-8 text-center text-sm">
        {{ state.search ? t('empty.searchTitle', { query: state.search }) : t('empty.noData') }}
      </div>
    </div>

    <!-- Footer -->
    <footer v-if="rows.length" class="flex flex-col gap-2">
      <TablePagination v-if="pagination === 'pages'" :table="table" />
      <div v-else-if="pagination === 'load-more'" class="flex flex-col items-center gap-2 text-sm">
        <span class="text-base-content/60">{{ t('pagination.showing', { count: rows.length, total: meta.total }) }}</span>
        <button v-if="meta.hasMore" type="button" class="btn btn-sm btn-ghost border-base-content/15 border" :disabled="table.isFetching.value" @click="table.loadMore()">
          <span v-if="table.isFetching.value" class="loading loading-spinner loading-xs" />
          {{ t('action.loadMore') }}
        </button>
      </div>
      <p v-if="showKeyboardHint && keyboardNav" class="text-base-content/50 hidden items-center gap-3 text-xs md:flex">
        <MrcIcon name="keyboard" :size="14" />
        <span><kbd class="kbd kbd-xs">↑</kbd><kbd class="kbd kbd-xs">↓</kbd> {{ t('keyboard.navigate') }}</span>
        <span><kbd class="kbd kbd-xs">Enter</kbd> {{ t('keyboard.edit') }}</span>
        <span><kbd class="kbd kbd-xs">Del</kbd> {{ t('keyboard.delete') }}</span>
        <span v-if="selectionEnabled"><kbd class="kbd kbd-xs">Space</kbd> {{ t('keyboard.select') }}</span>
      </p>
    </footer>

    <!-- Modal -->
    <MrcConfirm
      v-model:open="resetOpen"
      :title="t('confirm.resetTitle')"
      :description="t('confirm.resetDesc')"
      :confirm-label="t('action.yesReset')"
      tone="warning"
      @confirm="doReset"
    />
    <MrcConfirm
      v-if="onBulkDelete"
      v-model:open="bulkDeleteOpen"
      :title="t('bulk.deleteTitle', { count: table.selectedRows.value.length })"
      :description="t('bulk.deleteDesc')"
      :loading="bulkBusy"
      @confirm="runBulkDelete"
    />
    <MrcConfirm
      v-if="activeBulk"
      v-model:open="bulkConfirmOpen"
      :title="activeBulk.title ?? activeBulk.label"
      :description="activeBulk.description ?? t('bulk.selected', { count: table.selectedRows.value.length })"
      :confirm-label="activeBulk.label"
      :tone="activeBulk.tone"
      :loading="bulkBusy"
      @confirm="runBulk({})"
    />
    <MrcModal
      v-if="activeBulk?.mode === 'form'"
      v-model:open="bulkFormOpen"
      :title="activeBulk.title ?? activeBulk.label"
      :subtitle="activeBulk.description ?? t('bulk.selected', { count: table.selectedRows.value.length })"
      :dismissible="!bulkBusy"
    >
      <MrcForm ref="bulkForm" v-model="bulkValues" v-model:errors="bulkErrors" :fields="activeBulk.fields ?? []" @submit="runBulk" />
      <template #footer>
        <button type="button" class="btn btn-ghost btn-sm" :disabled="bulkBusy" @click="bulkFormOpen = false">{{ t('action.cancel') }}</button>
        <button type="button" class="btn btn-sm" :class="TONE_BTN[activeBulk.tone ?? 'primary']" :disabled="bulkBusy" @click="bulkForm?.submit()">
          <span v-if="bulkBusy" class="loading loading-spinner loading-xs" />
          {{ activeBulk.label }}
        </button>
      </template>
    </MrcModal>
    <ExportModal
      v-if="exportable"
      v-model:open="exportOpen"
      :table="table"
      :title="title ?? name ?? 'Data'"
      :formats="exportOpts.formats"
      :filename="exportOpts.filename"
    />
  </section>
</template>
