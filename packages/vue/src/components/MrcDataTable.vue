<script setup lang="ts" generic="T extends Record<string, any>">
/**
 * DataTable lengkap — porting `datatable-js.blade.php` beserta toolbar,
 * table-content, pagination, dan modal dari mrcatz/datatable versi Laravel,
 * sehingga tampilannya identik.
 *
 * Handler asinkron dipasang sebagai listener biasa — tabel menunggu
 * hasilnya (loading, konfirmasi, refresh otomatis):
 *
 * <MrcDataTable
 *   name="pengguna" entity="Pengguna"
 *   :source="source" :columns="columns"
 *   @create="openForm()" @edit="openForm" @delete="confirmDelete"
 *   @cell-update="(row, key, value) => api.patch(row.id, { [key]: value })"
 *   @bulk-delete="(rows) => api.removeMany(rows.map(r => r.id))"
 * />
 */
import { computed, nextTick, ref, useSlots, watch } from 'vue';
import type { FilterSchema, FilterValue, SortRule, TablePage } from '@mrc4tz/datatable-core';
import { useMrcatz } from '../config';
import { allowed, cellValue, type CellContext, type ColumnDef } from '../columns';
import type { DataSource } from '../sources';
import type { BulkAction } from '../bulk';
import type { ExpandField } from '../expand';
import type { ExportOptions } from '../export';
import { initialValues, type FormValues } from '../fields';
import { errorMessage, MrcFormError, type FormErrors } from '../validation';
import { useDataTable, type PaginationMode, type RowKey } from '../composables/useDataTable';
import MrcIcon from './MrcIcon.vue';
import MrcConfirm from './MrcConfirm.vue';
import MrcModal from './MrcModal.vue';
import MrcPopover from './MrcPopover.vue';
import MrcExpandFields from './MrcExpandFields.vue';
import FilterPanel from './filters/FilterPanel.vue';
import ColumnMenu from './table/ColumnMenu.vue';
import PresetMenu from './table/PresetMenu.vue';
import TablePagination from './table/TablePagination.vue';
import TableCell from './table/TableCell.vue';
import InlineEditCell from './table/InlineEditCell.vue';
import ExportModal from './table/ExportModal.vue';
import BulkActionModal from './table/BulkActionModal.vue';

const props = withDefaults(
  defineProps<{
    source: DataSource<T>;
    columns: ColumnDef<T>[];
    /** Namespace URL/cache/preset — wajib unik bila ada >1 tabel di halaman (pengganti `setPageName`). */
    name?: string;
    /** Judul tabel: aria-label, judul export, dan judul yang tampil bila `showTitle`. */
    title?: string;
    description?: string;
    showTitle?: boolean;
    /** Nama entitas untuk notifikasi, mis. "User" → "User berhasil diupdate!". */
    entity?: string;

    searchable?: boolean;
    /** `submit` (Enter, default Laravel), `live` (cari saat mengetik dengan debounce). */
    searchMode?: 'live' | 'submit';
    searchDebounce?: number;
    /** Jeda (ms) filter select/tanggal sebelum diterapkan (pengganti `$filterDebounceDelay`). Default 300. */
    filterDebounce?: number;
    searchPlaceholder?: string;

    perPageOptions?: number[];
    defaultSort?: SortRule[];
    /** Schema filter statis (bila sumber tidak menyediakan `schema`). */
    filters?: FilterSchema[];
    pagination?: PaginationMode;
    /** Jumlah baris per halaman di awal (pengganti `$p`). */
    defaultPerPage?: number;
    /** Baris per klik "Muat lebih banyak" (pengganti `$maxRows`). */
    loadMoreChunk?: number;
    /** Tampilkan tombol "Muat lebih banyak" (pengganti `$showLoadMoreButton`). `false` = hanya potongan pertama. */
    loadMoreButton?: boolean;
    /** Indikator memuat: `skeleton` (default), `fullscreen` (pengganti `$withLoading`), atau `false`. */
    loadingOverlay?: 'skeleton' | 'fullscreen' | false;
    /** Prefix query string URL (pengganti `urlPrefix()`). Default `"{name}_"`. */
    urlPrefix?: string;
    syncUrl?: boolean;
    rowKey?: RowKey<T>;

    /** Kotak centang per baris; fungsi untuk menentukan baris mana yang bisa dipilih (pengganti `enableBulk`). */
    selectable?: boolean | ((row: T) => boolean);
    /** Tombol "Pilih" untuk menyalakan/mematikan mode seleksi (pengganti `$showBulkButton`). */
    selectionToggle?: boolean;
    bulkActions?: BulkAction<T>[];
    /** Baris bisa dibuka: `true`/`both`, atau hanya `desktop`/`mobile` (pengganti `$expandableRows`). */
    expandable?: boolean | 'both' | 'desktop' | 'mobile';
    /** Isi expand otomatis; alternatifnya slot `#expand`. */
    expandFields?: ExpandField[] | ((row: T) => ExpandField[] | null);
    /**
     * Baris mana yang bisa dibuka (pengganti `enableExpand()` yang mengembalikan `null`).
     * Berlaku juga saat memakai slot `#expand`.
     */
    expandWhen?: (row: T) => boolean;

    /** Bungkus tabel dalam kartu (pengganti `$cardContainer`). */
    card?: boolean;
    /** Bingkai tipis (pengganti `$borderContainer`). */
    bordered?: boolean;
    /** Baris belang (pengganti `$tableZebraStyle`). */
    zebra?: boolean;
    stickyHeader?: boolean;
    /** Tampilan kartu di layar kecil (pengganti `$showCardOnMobile`). */
    mobileCards?: boolean;
    columnVisibility?: boolean;
    columnReorder?: boolean;
    columnResize?: boolean;
    sorting?: boolean;
    keyboardNav?: boolean;
    showKeyboardHint?: boolean;
    exportable?: boolean | ExportOptions;
    presets?: boolean;
    showRefresh?: boolean;
    /** Tampilkan tombol Tambah. Default: otomatis bila ada listener `@create`. */
    creatable?: boolean;
    createLabel?: string;

    onCreate?: () => void;
    onEdit?: (row: T) => void;
    onDelete?: (row: T) => void;
    onRowClick?: (row: T) => void;
    /** `value` sudah melewati `editable.parse` (default: angka untuk input `number`). */
    onCellUpdate?: (row: T, key: string, value: any) => unknown;
    onBulkDelete?: (rows: T[]) => unknown;
    onBulkAction?: (action: BulkAction<T>, rows: T[], values: FormValues) => unknown;
  }>(),
  {
    searchable: true,
    searchMode: 'submit',
    searchDebounce: 500,
    loadMoreButton: true,
    loadingOverlay: 'skeleton',
    filterDebounce: 300,
    pagination: 'pages',
    syncUrl: true,
    selectable: false,
    selectionToggle: false,
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
    showRefresh: false,
    creatable: undefined,
  },
);

const emit = defineEmits<{
  'selection-change': [rows: T[]];
  /** Data baru diterima (pengganti `onDataLoaded`). */
  loaded: [page: TablePage<T>];
  /** Nilai filter berubah (pengganti `onFilterChanged`). */
  'filter-change': [id: string, value: FilterValue | undefined, filters: Record<string, FilterValue>];
}>();
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
  defaultPerPage: props.defaultPerPage,
  loadMoreChunk: props.loadMoreChunk,
  urlPrefix: props.urlPrefix,
  onLoaded: (page) => emit('loaded', page),
  onFilterChange: (id, value, filters) => emit('filter-change', id, value, filters),
  syncUrl: props.syncUrl,
  rowKey: props.rowKey,
});
const { state, meta, rows } = table;
watch(table.selectedRows, (r) => emit('selection-change', r));

const entityName = computed(() => props.entity ?? props.title ?? 'Data');

// ---------------------------------------------------------------- pencarian
let searchTimer: ReturnType<typeof setTimeout> | undefined;
function onSearchInput(v: string) {
  table.searchInput.value = v;
  if (props.searchMode !== 'live') return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => table.applySearch(), props.searchDebounce);
}

// ---------------------------------------------------------------- toolbar
const filterOpen = ref(false);
const hasFilters = computed(() => table.filters.value.length > 0);
const showPresets = computed(() => props.presets && (hasFilters.value || props.searchable));
const presetOpen = ref(false);
const columnsOpen = ref(false);
const resetOpen = ref(false);
const exportOpen = ref(false);
const mobilePresetOpen = ref(false);
const mobileColumnsOpen = ref(false);
const showCreate = computed(() => props.creatable ?? !!props.onCreate);
const exportOpts = computed(() => (typeof props.exportable === 'object' ? props.exportable : {}));

/** Ada pencarian/filter aktif → minta konfirmasi; selain itu reset langsung. */
function askReset() {
  if (state.search || table.activeFilterCount.value > 0) resetOpen.value = true;
  else doReset();
}
function doReset() {
  table.reset();
  expanded.value = new Set();
  resetOpen.value = false;
}

// ---------------------------------------------------------------- kolom
const desktopColumns = computed(() => table.visibleColumns.value.filter((c) => c.showOn !== 'mobile'));
const mobileColumns = computed(() => table.visibleColumns.value.filter((c) => c.showOn !== 'desktop'));
const imageColumn = computed(() => table.visibleColumns.value.find((c) => c.kind === 'image'));
const mobileParts = computed(() => {
  const list = mobileColumns.value.filter((c) => c.kind !== 'rowNumber' && c !== imageColumn.value);
  const actions = list.filter((c) => c.kind === 'actions');
  const data = list.filter((c) => c.kind !== 'actions');
  return { first: data[0], rest: data.slice(1), actions };
});

const align = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;
const sortKey = (c: ColumnDef<T>) => c.sortKey ?? c.key ?? '';
const isSortable = (c: ColumnDef<T>) => props.sorting && c.sortable && !!c.key;
function colStyle(c: ColumnDef<T>) {
  const w = state.widths[c.id] ?? c.width;
  return w ? { width: `${w}px`, minWidth: `${w}px` } : undefined;
}

// Resize — sama dengan `startResize` versi Laravel.
function startResize(c: ColumnDef<T>, e: MouseEvent) {
  const th = (e.target as HTMLElement).closest('th');
  if (!th) return;
  const startX = e.pageX;
  const startW = th.offsetWidth;
  const move = (ev: MouseEvent) => table.setWidth(c.id, Math.max(50, startW + ev.pageX - startX));
  const up = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

// Reorder — seret header ke posisi kolom lain.
const dragCol = ref<string | null>(null);
const dragOverCol = ref<string | null>(null);
function onDrop(target: ColumnDef<T>) {
  if (dragCol.value) table.moveColumnTo(dragCol.value, target.id);
  dragCol.value = dragOverCol.value = null;
}

// ---------------------------------------------------------------- seleksi
const canSelect = (row: T) => (typeof props.selectable === 'function' ? props.selectable(row) : !!props.selectable);
const selectionEnabled = computed(() => !!props.selectable && (!props.selectionToggle || selectionMode.value));
watch(selectionEnabled, (on) => {
  if (!on) table.clearSelection();
});
const pageSelectable = computed(() => rows.value.filter(canSelect));
const pageAllSelected = computed(() => pageSelectable.value.length > 0 && pageSelectable.value.every(table.isSelected));

// ---------------------------------------------------------------- expand
const expandOn = computed(() => (props.expandable === true ? 'both' : props.expandable || null));
const expandDesktop = computed(() => expandOn.value === 'both' || expandOn.value === 'desktop');
const expandMobile = computed(() => expandOn.value === 'both' || expandOn.value === 'mobile');
const expanded = ref(new Set<string>());
function expandContent(row: T): ExpandField[] | null {
  const f = props.expandFields;
  return typeof f === 'function' ? f(row) : (f ?? null);
}
const hasExpand = (row: T) => {
  if (props.expandWhen && !props.expandWhen(row)) return false;
  // `expandFields` fungsi yang mengembalikan `null` menyembunyikan chevron, meski ada slot.
  if (typeof props.expandFields === 'function' && !props.expandFields(row)) return false;
  return !!slots.expand || !!expandContent(row);
};
function toggleExpand(row: T) {
  const k = table.keyOf(row);
  const next = new Set(expanded.value);
  next.has(k) ? next.delete(k) : next.add(k);
  expanded.value = next;
}
const mobileExpandRow = ref<T | null>(null);
const mobileExpandOpen = ref(false);
function openMobileExpand(row: T) {
  mobileExpandRow.value = row;
  mobileExpandOpen.value = true;
}

const totalColspan = computed(() => desktopColumns.value.length + (selectionEnabled.value ? 1 : 0) + (expandDesktop.value ? 1 : 0));
const ctxOf = (index: number): CellContext => ({
  index,
  number: props.pagination === 'pages' ? (meta.value.page - 1) * meta.value.limit + index + 1 : index + 1,
  search: state.search,
});

// ---------------------------------------------------------------- inline edit
function canInlineEdit(c: ColumnDef<T>, row: T) {
  return !!props.onCellUpdate && !!c.editable && !!c.key && allowed(c.editable.when, row);
}
async function saveCell(c: ColumnDef<T>, row: T, raw: string): Promise<string | null> {
  try {
    const cfg = c.editable || {};
    const value = cfg.parse ? cfg.parse(raw, row) : cfg.input === 'number' && raw !== '' ? Number(raw) : raw;
    await props.onCellUpdate!(row, c.key!, value);
    notify('success', `${entityName.value} ${t('crud.success')} ${t('crud.updated')}`);
    await table.refresh();
    return null;
  } catch (e) {
    const msg = errorMessage(e, t('inline.failed'));
    notify('error', msg);
    return msg;
  }
}

// ---------------------------------------------------------------- aksi massal
const bulkDeleteOpen = ref(false);
const bulkBusy = ref(false);
const activeBulk = ref<BulkAction<T> | null>(null);
const bulkValues = ref<FormValues>({});
const bulkErrors = ref<FormErrors>({});
const visibleBulkActions = computed(() => (props.bulkActions ?? []).filter((a) => !a.when || a.when(table.selectedRows.value)));
const showBulkDelete = computed(() => !!props.onBulkDelete);
const mobileOverflow = computed(() => (showBulkDelete.value ? visibleBulkActions.value : visibleBulkActions.value.slice(1)));
const bulkBtn: Record<string, string> = {
  primary: 'btn-primary', secondary: 'btn-secondary', accent: 'btn-accent', neutral: 'btn-neutral', info: 'btn-info',
  success: 'btn-success', warning: 'btn-warning', error: 'btn-error', ghost: 'btn-ghost',
};
const bulkText: Record<string, string> = {
  primary: 'text-primary', secondary: 'text-secondary', accent: 'text-accent', neutral: 'text-neutral', info: 'text-info',
  success: 'text-success', warning: 'text-warning', error: 'text-error', ghost: 'text-base-content',
};
const moreOpen = ref(false);

async function runBulkDelete() {
  bulkBusy.value = true;
  try {
    const count = table.selectedRows.value.length;
    await props.onBulkDelete!(table.selectedRows.value);
    bulkDeleteOpen.value = false;
    table.clearSelection();
    notify('success', `${count} data ${t('crud.success')} ${t('crud.deleted')}`);
    await table.refresh();
  } catch (e) {
    notify('error', errorMessage(e, `${entityName.value} ${t('crud.failed')}`));
  } finally {
    bulkBusy.value = false;
  }
}

function openBulk(action: BulkAction<T>) {
  moreOpen.value = false;
  if (action.mode === 'instant') {
    activeBulk.value = action;
    return void runBulk({});
  }
  bulkValues.value = initialValues(action.fields ?? []);
  bulkErrors.value = {};
  activeBulk.value = action;
}

async function runBulk(values: FormValues) {
  const action = activeBulk.value;
  if (!action || !props.onBulkAction) return;
  bulkBusy.value = true;
  try {
    const count = table.selectedRows.value.length;
    const result = await props.onBulkAction(action, table.selectedRows.value, values);
    activeBulk.value = null;
    table.clearSelection();
    const message =
      typeof result === 'string' && result
        ? result
        : action.notify === false
          ? null
          : typeof action.notify === 'string'
            ? action.notify
            : typeof action.notify === 'function'
              ? action.notify(count)
              : `${count} data ${t('crud.success')} ${t('crud.updated')}`;
    if (message) notify('success', message);
    await table.refresh();
  } catch (e) {
    if (e instanceof MrcFormError) bulkErrors.value = e.fields;
    notify('error', errorMessage(e, `${entityName.value} ${t('crud.failed')}`));
  } finally {
    bulkBusy.value = false;
  }
}

// ---------------------------------------------------------------- keyboard
const focused = ref(-1);
const tableEl = ref<HTMLTableElement>();
watch(rows, () => (focused.value = -1));
const actionColumn = computed(() => props.columns.find((c) => c.kind === 'actions'));
const isTyping = (e: KeyboardEvent) => {
  const tag = (e.target as HTMLElement).tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
};

function onKeydown(e: KeyboardEvent) {
  if (!props.keyboardNav || isTyping(e)) return;
  const row = rows.value[focused.value];
  switch (e.key) {
    case 'ArrowUp':
      e.preventDefault();
      if (focused.value > 0) focused.value--;
      break;
    case 'ArrowDown':
      e.preventDefault();
      if (focused.value < rows.value.length - 1) focused.value++;
      break;
    case 'Escape':
      e.preventDefault();
      focused.value = -1;
      break;
    case 'Enter':
      if (row && props.onEdit && actionColumn.value && allowed(actionColumn.value.actions?.edit, row)) {
        e.preventDefault();
        props.onEdit(row);
      }
      break;
    case 'Delete':
    case 'Backspace':
      if (row && props.onDelete && actionColumn.value && allowed(actionColumn.value.actions?.delete, row)) {
        e.preventDefault();
        props.onDelete(row);
      }
      break;
    default:
      return;
  }
  void nextTick(() => tableEl.value?.querySelectorAll('tbody tr[data-row]')[focused.value]?.scrollIntoView({ block: 'nearest' }));
}

function onRowClick(row: T, index: number) {
  focused.value = index;
  props.onRowClick?.(row);
}

function rowStyle(i: number) {
  if (focused.value === i) return { background: 'color-mix(in srgb, var(--color-primary) 25%, transparent)' };
  if (props.zebra && i % 2 === 1) return { background: 'color-mix(in srgb, var(--color-base-content) 3%, transparent)' };
  return undefined;
}

const hasData = computed(() => rows.value.length > 0);
const busy = computed(() => table.isFetching.value);
const skeletonRows = computed(() => Math.min(state.limit, 5));
const searchIcon =
  'M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z';

defineExpose({ table, refresh: table.refresh, reset: table.reset, clearSelection: table.clearSelection });
</script>

<template>
  <div class="mrc-datatable" data-mrcatz-datatable-root>
    <header v-if="showTitle && (title || $slots.title)" class="mb-4">
      <slot name="title">
        <h2 class="text-base-content text-lg font-semibold">{{ title }}</h2>
        <p v-if="description" class="text-base-content/60 text-sm">{{ description }}</p>
      </slot>
    </header>

    <!-- ========== TOOLBAR MOBILE (md:hidden) ========== -->
    <div v-if="mobileCards" class="mb-4 flex flex-col gap-2 md:hidden">
      <form v-if="searchable" @submit.prevent="table.applySearch()">
        <label class="input input-bordered input-sm focus-within:input-primary flex w-full items-center gap-2 transition-all duration-200 focus-within:shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="text-base-content/40 h-4 w-4"><path fill-rule="evenodd" :d="searchIcon" clip-rule="evenodd" /></svg>
          <input type="text" class="grow text-sm" :value="table.searchInput.value" :placeholder="searchPlaceholder ?? t('search.placeholder')" @input="onSearchInput(($event.target as HTMLInputElement).value)" />
        </label>
      </form>

      <div class="flex flex-wrap items-center gap-2.5">
        <label v-if="hasFilters" class="btn btn-square btn-primary swap swap-rotate tooltip tooltip-bottom min-h-[44px] min-w-[44px]" :class="{ 'swap-active': filterOpen }" data-tip="Filter">
          <input type="checkbox" :checked="filterOpen" @change="filterOpen = !filterOpen" />
          <MrcIcon name="tune" class="swap-off" />
          <MrcIcon name="close" class="swap-on" />
        </label>
        <button v-if="showPresets" type="button" class="btn btn-ghost btn-square border-base-content/15 tooltip tooltip-bottom min-h-[44px] min-w-[44px] border" :data-tip="t('filter.preset')" @click="mobilePresetOpen = true">
          <MrcIcon name="bookmarks" />
        </button>
        <button v-if="columnVisibility" type="button" class="btn btn-ghost btn-square border-base-content/15 tooltip tooltip-bottom min-h-[44px] min-w-[44px] border" :data-tip="t('column.toggle')" @click="mobileColumnsOpen = true">
          <MrcIcon name="view_column" />
        </button>
        <button v-if="hasFilters || searchable" type="button" class="btn btn-ghost btn-square border-base-content/15 tooltip tooltip-bottom min-h-[44px] min-w-[44px] border" :data-tip="t('action.reset')" @click="askReset">
          <MrcIcon name="restart_alt" />
        </button>
        <div class="flex-1" />
        <button v-if="exportable" type="button" class="btn btn-ghost border-base-content/15 btn-square tooltip tooltip-bottom min-h-[44px] min-w-[44px] border" :data-tip="t('action.export')" @click="exportOpen = true">
          <MrcIcon name="download" />
        </button>
        <button
          v-if="selectable && selectionToggle"
          type="button"
          class="btn btn-square tooltip tooltip-bottom min-h-[44px] min-w-[44px]"
          :class="selectionMode ? 'btn-secondary' : 'btn-ghost border-base-content/15 border'"
          :data-tip="t('action.select')"
          :aria-pressed="selectionMode"
          @click="selectionMode = !selectionMode"
        >
          <MrcIcon :name="selectionMode ? 'check_box' : 'check_box_outline_blank'" />
        </button>
        <button v-if="showCreate" type="button" class="btn btn-primary min-h-[44px] gap-2 shadow-sm" @click="onCreate?.()">
          <MrcIcon name="add" />
          <span>{{ createLabel ?? t('action.add') }}</span>
        </button>
      </div>

      <div v-if="hasFilters && table.activeFilterCount.value > 0" class="bg-base-200/40 flex w-fit items-center gap-2 rounded-xl px-2.5 py-1.5">
        <MrcIcon name="filter_alt" :size="14" class="text-base-content/40" />
        <p class="text-base-content/60 text-xs">
          <span class="text-base-content font-semibold">{{ table.activeFilterCount.value }}</span> {{ t('filter.active') }}
        </p>
      </div>
    </div>

    <!-- ========== TOOLBAR DESKTOP ========== -->
    <div class="mb-4 gap-x-3 gap-y-2" :class="mobileCards ? 'hidden md:flex md:flex-wrap md:items-center md:justify-between' : 'flex flex-wrap items-center justify-between'">
      <div class="flex flex-wrap items-center gap-2">
        <form v-if="searchable" class="min-w-0" @submit.prevent="table.applySearch()">
          <label class="input input-bordered input-md focus-within:input-primary flex w-72 max-w-full items-center gap-2 transition-all duration-200 focus-within:shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="text-base-content/40 h-4 w-4"><path fill-rule="evenodd" :d="searchIcon" clip-rule="evenodd" /></svg>
            <input type="text" class="grow text-sm" :value="table.searchInput.value" :placeholder="searchPlaceholder ?? t('search.placeholder')" @input="onSearchInput(($event.target as HTMLInputElement).value)" />
          </label>
        </form>

        <template v-if="hasFilters">
          <label class="btn btn-md btn-square btn-primary swap swap-rotate tooltip tooltip-bottom" :class="{ 'swap-active': filterOpen }" data-tip="Filter">
            <input type="checkbox" :checked="filterOpen" @change="filterOpen = !filterOpen" />
            <MrcIcon name="tune" class="swap-off" />
            <MrcIcon name="close" class="swap-on" />
          </label>
          <div v-if="table.activeFilterCount.value > 0" class="bg-base-200/40 flex items-center gap-2 rounded-xl px-3 py-1.5">
            <MrcIcon name="filter_alt" :size="14" class="text-base-content/40" />
            <p class="text-base-content/60 text-sm">
              <span class="text-base-content font-semibold">{{ table.activeFilterCount.value }}</span> {{ t('filter.active') }}
            </p>
          </div>
        </template>

        <MrcPopover v-if="showPresets" v-model:open="presetOpen" align="end" width="16rem">
          <template #trigger="{ toggle }">
            <button type="button" class="btn btn-md btn-ghost btn-square border-base-content/15 tooltip tooltip-bottom border" :data-tip="t('filter.preset')" @click="toggle">
              <MrcIcon name="bookmarks" />
            </button>
          </template>
          <PresetMenu :table="table" @applied="presetOpen = false" />
        </MrcPopover>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <slot name="toolbar" :table="table" />
        <button v-if="showCreate" type="button" class="btn btn-md btn-primary tooltip tooltip-bottom gap-2 shadow-sm" :data-tip="createLabel ?? t('action.add')" @click="onCreate?.()">
          <MrcIcon name="add" />
          <span>{{ createLabel ?? t('action.add') }}</span>
        </button>
        <button
          v-if="selectable && selectionToggle"
          type="button"
          class="btn btn-md tooltip tooltip-bottom gap-1"
          :class="selectionMode ? 'btn-secondary' : 'btn-ghost border-base-content/15 border'"
          :data-tip="t('action.select')"
          :aria-label="t('action.select')"
          :aria-pressed="selectionMode"
          @click="selectionMode = !selectionMode"
        >
          <MrcIcon :name="selectionMode ? 'check_box' : 'check_box_outline_blank'" />
          <span class="text-sm">{{ t('action.select') }}</span>
        </button>
        <button v-if="exportable" type="button" class="btn btn-md btn-ghost border-base-content/15 tooltip tooltip-bottom gap-1 border" :data-tip="t('action.export')" @click="exportOpen = true">
          <MrcIcon name="download" />
          <span class="text-sm">{{ t('action.export') }}</span>
        </button>
        <MrcPopover v-if="columnVisibility" v-model:open="columnsOpen" align="end" width="14rem">
          <template #trigger="{ toggle }">
            <button type="button" class="btn btn-md btn-ghost btn-square border-base-content/15 tooltip tooltip-bottom border" :data-tip="t('column.toggle')" @click="toggle">
              <MrcIcon name="view_column" />
            </button>
          </template>
          <ColumnMenu :table="table" />
        </MrcPopover>
        <button v-if="showRefresh" type="button" class="btn btn-md btn-ghost btn-square border-base-content/15 tooltip tooltip-bottom border" :data-tip="t('action.refresh')" @click="table.refresh()">
          <MrcIcon name="refresh" :class="{ 'animate-spin': busy }" />
        </button>
        <button v-if="hasFilters || searchable" type="button" class="btn btn-md btn-ghost btn-square border-base-content/15 tooltip tooltip-bottom border" :data-tip="t('action.reset')" @click="askReset">
          <MrcIcon name="restart_alt" />
        </button>
      </div>
    </div>

    <!-- Panel filter -->
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 -translate-y-2"
      leave-active-class="transition ease-in duration-150"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <FilterPanel v-if="hasFilters && filterOpen" :table="table" :debounce="filterDebounce" />
    </Transition>

    <!-- Bar aksi massal -->
    <div
      v-if="selectionEnabled && table.selectedRows.value.length"
      class="bg-primary/5 border-primary/20 mb-4 flex flex-col gap-2 rounded-xl border px-3 py-2 sm:flex-row sm:items-center sm:justify-between md:px-4 md:py-2.5"
    >
      <div class="flex items-center gap-2">
        <MrcIcon name="check_circle" :size="16" class="text-primary" />
        <span class="text-primary text-sm font-medium">{{ table.selectedRows.value.length }} {{ t('bulk.selected') }}</span>
      </div>
      <div class="flex flex-wrap gap-2">
        <slot name="bulk" :rows="table.selectedRows.value" />
        <button
          v-for="(a, i) in visibleBulkActions"
          :key="a.id"
          type="button"
          class="btn btn-xs btn-outline max-w-full min-w-0 flex-1 gap-1 sm:max-w-[14rem] sm:flex-none"
          :class="[bulkBtn[a.tone ?? 'primary'], !showBulkDelete && i === 0 ? 'flex' : 'hidden sm:flex']"
          :title="a.label"
          @click="openBulk(a)"
        >
          <MrcIcon :name="a.icon ?? 'edit'" :size="12" class="shrink-0" />
          <span class="truncate">{{ a.label }}</span>
        </button>
        <MrcPopover v-if="mobileOverflow.length" v-model:open="moreOpen" align="end" width="14rem" class="flex-1 sm:hidden" panel-class="bg-base-100 border-base-content/10 rounded-box border p-1 text-sm shadow-lg">
          <template #trigger="{ toggle }">
            <button type="button" class="btn btn-xs btn-ghost btn-outline w-full min-w-0 gap-1" @click="toggle">
              <span class="truncate">{{ t('action.more') }}</span>
              <MrcIcon name="expand_more" :size="12" class="shrink-0" />
            </button>
          </template>
          <ul class="menu w-full p-0">
            <li v-for="a in mobileOverflow" :key="a.id">
              <button type="button" class="flex items-center gap-2" @click="openBulk(a)">
                <MrcIcon :name="a.icon ?? 'edit'" :size="14" class="shrink-0" :class="bulkText[a.tone ?? 'primary']" />
                <span class="truncate">{{ a.label }}</span>
              </button>
            </li>
          </ul>
        </MrcPopover>
        <button v-if="showBulkDelete" type="button" class="btn btn-xs btn-error btn-outline min-w-0 flex-1 gap-1 sm:flex-none" @click="bulkDeleteOpen = true">
          <MrcIcon name="delete" :size="12" class="shrink-0" />
          <span class="truncate">{{ t('action.delete') }}</span>
        </button>
        <button type="button" class="btn btn-xs btn-ghost min-w-0 flex-1 gap-1 sm:flex-none" @click="table.clearSelection()">
          <MrcIcon name="close" :size="12" class="shrink-0" />
          <span class="truncate">{{ t('action.cancel') }}</span>
        </button>
      </div>
    </div>

    <!-- Error memuat -->
    <div v-if="table.error.value && !hasData" role="alert" class="alert alert-error alert-soft mb-4">
      <MrcIcon name="error" />
      <span>{{ t('error') }}: {{ errorMessage(table.error.value, '') }}</span>
      <button type="button" class="btn btn-sm" @click="table.refresh()">{{ t('retry') }}</button>
    </div>

    <!-- ========== KONTEN TABEL ========== -->
    <div
      class="md:bg-base-100 w-full md:overflow-hidden"
      :class="[card && 'md:card md:shadow-md', bordered && 'md:border-base-content/10 md:rounded-xl md:border']"
    >
      <div :class="card && 'md:card-body md:p-0'">
        <div class="relative">
          <template v-if="hasData">
            <!-- Kartu mobile -->
            <div v-if="mobileCards" class="space-y-3 pt-3 md:hidden" :class="{ invisible: busy }">
              <div
                v-for="(row, i) in rows"
                :key="table.keyOf(row)"
                class="border-base-content/8 bg-base-100 rounded-xl border shadow-sm transition-all duration-150"
                :class="focused === i && 'ring-primary/30 border-primary/20 ring-2'"
                @click="onRowClick(row, i)"
              >
                <div class="flex items-start justify-between gap-3 px-4 pt-3 pb-2">
                  <div v-if="imageColumn" class="mt-0.5 shrink-0">
                    <TableCell :column="imageColumn" :row="row" :ctx="ctxOf(i)" />
                  </div>
                  <div class="min-w-0 flex-1 overflow-hidden">
                    <template v-if="mobileParts.first">
                      <span class="text-base-content/30 flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase">{{ mobileParts.first.label }}</span>
                      <InlineEditCell
                        v-if="canInlineEdit(mobileParts.first, row) && mobileParts.first.editable"
                        compact
                        class="text-base-content truncate text-sm font-semibold"
                        :config="mobileParts.first.editable"
                        :value="cellValue(mobileParts.first, row)"
                        :row="row"
                        :save="(v) => saveCell(mobileParts.first!, row, v)"
                      >
                        <TableCell :column="mobileParts.first" :row="row" :ctx="ctxOf(i)" />
                      </InlineEditCell>
                      <p v-else class="text-base-content truncate text-sm font-semibold" :class="{ uppercase: mobileParts.first.uppercase }">
                        <slot v-if="$slots[`cell-${mobileParts.first.id}`]" :name="`cell-${mobileParts.first.id}`" :row="row" :value="cellValue(mobileParts.first, row)" v-bind="ctxOf(i)" />
                        <TableCell v-else :column="mobileParts.first" :row="row" :ctx="ctxOf(i)" />
                      </p>
                    </template>
                  </div>
                  <div class="flex shrink-0 items-center gap-1">
                    <input
                      v-if="selectionEnabled && canSelect(row)"
                      type="checkbox"
                      class="checkbox checkbox-sm checkbox-primary"
                      :checked="table.isSelected(row)"
                      :aria-label="`${t('action.select')} row ${i + 1}`"
                      @click.stop
                      @change="table.toggleRow(row)"
                    />
                    <span v-for="c in mobileParts.actions" :key="c.id" @click.stop>
                      <TableCell :column="c" :row="row" :ctx="ctxOf(i)" @edit="onEdit?.(row)" @delete="onDelete?.(row)" />
                    </span>
                  </div>
                </div>

                <div v-if="mobileParts.rest.length" class="grid grid-cols-2 gap-1.5 px-4 pb-3">
                  <div v-for="c in mobileParts.rest" :key="c.id" class="bg-base-200/40 min-w-0 overflow-hidden rounded-lg px-3 py-2">
                    <span class="text-base-content/40 mb-0.5 block text-[11px]">{{ c.label }}</span>
                    <InlineEditCell
                      v-if="canInlineEdit(c, row) && c.editable"
                      compact
                      class="text-base-content/80 block truncate text-sm"
                      :config="c.editable"
                      :value="cellValue(c, row)"
                      :row="row"
                      :save="(v) => saveCell(c, row, v)"
                    >
                      <TableCell :column="c" :row="row" :ctx="ctxOf(i)" />
                    </InlineEditCell>
                    <span v-else class="text-base-content/80 block truncate text-sm" :class="{ uppercase: c.uppercase }">
                      <slot v-if="$slots[`cell-${c.id}`]" :name="`cell-${c.id}`" :row="row" :value="cellValue(c, row)" v-bind="ctxOf(i)" />
                      <TableCell v-else :column="c" :row="row" :ctx="ctxOf(i)" />
                    </span>
                  </div>
                </div>

                <div v-if="expandMobile && hasExpand(row)" class="px-4 pb-3">
                  <button
                    type="button"
                    class="bg-base-200/30 hover:bg-base-200/60 text-base-content/40 hover:text-base-content/60 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs transition-colors"
                    @click.stop="openMobileExpand(row)"
                  >
                    <MrcIcon name="info" :size="16" />
                    {{ t('action.details') }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Tabel desktop -->
            <div class="overflow-x-auto" :class="[mobileCards ? 'hidden md:block' : 'block', stickyHeader && 'isolate max-h-[70vh] overflow-y-auto', busy && 'invisible']">
              <table
                ref="tableEl"
                class="table outline-none"
                role="grid"
                :aria-label="title ?? 'Data table'"
                :tabindex="keyboardNav ? 0 : undefined"
                @keydown="onKeydown"
              >
                <thead>
                  <tr class="border-base-content/10 border-b">
                    <th v-if="expandDesktop" class="w-8" :class="stickyHeader ? 'bg-base-200 sticky top-0 z-10' : 'bg-base-200/50'" />
                    <th v-if="selectionEnabled" class="w-10 text-center" :class="stickyHeader ? 'bg-base-200 sticky top-0 z-10' : 'bg-base-200/50'">
                      <input
                        type="checkbox"
                        class="checkbox checkbox-sm checkbox-primary"
                        :aria-label="`${t('action.select')} all`"
                        :checked="pageAllSelected"
                        @change="table.togglePage(canSelect)"
                      />
                    </th>
                    <th
                      v-for="c in desktopColumns"
                      :key="c.id"
                      class="text-base-content/50 relative text-xs font-semibold tracking-wider uppercase"
                      :class="[stickyHeader ? 'bg-base-200 sticky top-0 z-10' : 'bg-base-200/50', align[c.align]]"
                      :style="[colStyle(c), dragOverCol === c.id && dragCol && dragCol !== c.id ? { boxShadow: 'inset 3px 0 0 0 var(--color-primary)' } : {}]"
                      :aria-sort="table.sortOf(sortKey(c)) ? (table.sortOf(sortKey(c))!.dir === 'asc' ? 'ascending' : 'descending') : isSortable(c) ? 'none' : undefined"
                      :draggable="columnReorder || undefined"
                      @dragstart="dragCol = c.id"
                      @dragover.prevent="dragOverCol = c.id"
                      @drop.prevent="onDrop(c)"
                      @dragend="dragCol = dragOverCol = null"
                    >
                      <button
                        v-if="isSortable(c)"
                        type="button"
                        class="hover:text-primary flex items-center gap-1 transition-colors duration-200"
                        @click="table.toggleSort(sortKey(c), $event.shiftKey)"
                      >
                        <slot :name="`header-${c.id}`" :column="c">{{ c.label }}</slot>
                        <MrcIcon v-if="table.sortOf(sortKey(c))?.dir === 'asc'" name="keyboard_arrow_up" class="text-primary/50" />
                        <MrcIcon v-else-if="table.sortOf(sortKey(c))?.dir === 'desc'" name="keyboard_arrow_down" class="text-primary/50" />
                        <MrcIcon v-else name="unfold_more" class="opacity-40" />
                        <span v-if="table.sortOf(sortKey(c))?.priority" class="badge badge-xs badge-primary text-[9px] font-bold">{{ table.sortOf(sortKey(c))!.priority }}</span>
                      </button>
                      <template v-else-if="c.key || c.kind === 'rowNumber'">
                        <slot :name="`header-${c.id}`" :column="c">{{ c.label }}</slot>
                      </template>
                      <span v-else class="block text-center">
                        <slot :name="`header-${c.id}`" :column="c">{{ c.label || (c.kind === 'actions' ? t('column.actions') : '') }}</slot>
                      </span>

                      <div
                        v-if="columnResize && c.key"
                        class="group/rs absolute top-1/4 bottom-1/4 -right-0.5 z-10 flex w-3 cursor-col-resize items-center justify-center"
                        @mousedown.prevent.stop="startResize(c, $event)"
                        @click.stop
                      >
                        <div class="h-full w-[3px] rounded-full bg-[linear-gradient(to_bottom,transparent,var(--color-primary),transparent)] opacity-0 transition-opacity duration-200 group-hover/rs:opacity-100" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="(row, i) in rows" :key="table.keyOf(row)">
                    <tr
                      data-row
                      class="border-base-content/5 cursor-pointer border-b transition-colors duration-150"
                      :style="rowStyle(i)"
                      @click="onRowClick(row, i)"
                    >
                      <td v-if="expandDesktop" class="w-8 text-center">
                        <span
                          v-if="hasExpand(row)"
                          class="inline-flex h-8 w-6 cursor-pointer items-center justify-center transition-transform duration-500 ease-in-out"
                          :style="{ transform: expanded.has(table.keyOf(row)) ? 'rotate(90deg)' : 'rotate(0deg)' }"
                          role="button"
                          :aria-expanded="expanded.has(table.keyOf(row))"
                          :aria-label="t('action.details')"
                          @click.stop="toggleExpand(row)"
                        >
                          <MrcIcon name="chevron_right" class="text-base-content/40" />
                        </span>
                      </td>
                      <td v-if="selectionEnabled" class="w-10 text-center" @click.stop>
                        <input
                          v-if="canSelect(row)"
                          type="checkbox"
                          class="checkbox checkbox-sm checkbox-primary"
                          :aria-label="`${t('action.select')} row ${i + 1}`"
                          :checked="table.isSelected(row)"
                          @change="table.toggleRow(row)"
                        />
                      </td>
                      <component
                        :is="c.rowHeader ? 'th' : 'td'"
                        v-for="c in desktopColumns"
                        :key="c.id"
                        class="text-sm"
                        :class="[align[c.align], c.uppercase && 'uppercase', c.class]"
                        :style="colStyle(c)"
                      >
                        <InlineEditCell
                          v-if="canInlineEdit(c, row) && c.editable"
                          :config="c.editable"
                          :value="cellValue(c, row)"
                          :row="row"
                          :save="(v) => saveCell(c, row, v)"
                        >
                          <slot v-if="$slots[`cell-${c.id}`]" :name="`cell-${c.id}`" :row="row" :value="cellValue(c, row)" v-bind="ctxOf(i)" />
                          <TableCell v-else :column="c" :row="row" :ctx="ctxOf(i)" />
                        </InlineEditCell>
                        <slot v-else-if="$slots[`cell-${c.id}`]" :name="`cell-${c.id}`" :row="row" :value="cellValue(c, row)" v-bind="ctxOf(i)" />
                        <TableCell v-else :column="c" :row="row" :ctx="ctxOf(i)" @edit="onEdit?.(row)" @delete="onDelete?.(row)" />
                      </component>
                    </tr>
                    <tr v-if="expandDesktop && hasExpand(row) && expanded.has(table.keyOf(row))" class="bg-base-200/20">
                      <td :colspan="totalColspan" class="p-0">
                        <Transition appear enter-active-class="transition ease-out duration-200" enter-from-class="opacity-0 -translate-y-2">
                          <div class="px-6 py-4 text-sm">
                            <slot name="expand" :row="row">
                              <MrcExpandFields v-if="expandContent(row)" :row="row" :fields="expandContent(row)!" />
                            </slot>
                          </div>
                        </Transition>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </template>

          <!-- Kosong -->
          <div v-else-if="!table.isLoading.value && !table.error.value" :class="{ invisible: busy }">
            <slot name="empty" :search="state.search" :filtered="table.activeFilterCount.value > 0">
              <div class="flex flex-col items-center justify-center px-4 py-20">
                <div class="bg-base-200 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                  <MrcIcon :name="state.search || table.activeFilterCount.value ? 'search_off' : 'inbox'" class="text-base-content/30" />
                </div>
                <template v-if="state.search">
                  <p class="text-base-content/40 text-sm font-medium">{{ t('empty.searchTitle', { query: state.search }) }}</p>
                  <p class="text-base-content/25 mt-1 text-xs">{{ t('empty.searchHint') }}</p>
                </template>
                <template v-else-if="table.activeFilterCount.value">
                  <p class="text-base-content/40 text-sm font-medium">{{ t('empty.title') }}</p>
                  <p class="text-base-content/25 mt-1 text-xs">{{ t('empty.filterHint') }}</p>
                </template>
                <template v-else>
                  <p class="text-base-content/40 text-sm font-medium">{{ t('empty.noData') }}</p>
                  <p class="text-base-content/25 mt-1 text-xs">{{ t('empty.noDataHint') }}</p>
                </template>
              </div>
            </slot>
          </div>

          <!-- Skeleton loading (overlay agar tata letak tidak bergeser) -->
          <div v-if="loadingOverlay === 'skeleton' && (busy || table.isLoading.value)" class="z-10" :class="hasData ? 'bg-base-100/80 absolute inset-0' : 'relative'">
            <div v-if="mobileCards" class="space-y-3 pt-3 md:hidden">
              <div v-for="sk in Math.min(skeletonRows, 3)" :key="sk" class="border-base-content/8 bg-base-100 space-y-2 rounded-xl border p-4">
                <div class="space-y-1">
                  <div class="skeleton h-2.5 w-12 rounded" />
                  <div class="skeleton h-4 w-3/4 rounded" />
                </div>
                <div class="grid grid-cols-2 gap-1.5">
                  <div v-for="sc in Math.min(columns.length - 1, 4)" :key="sc" class="bg-base-200/40 space-y-1 rounded-lg px-3 py-2">
                    <div class="skeleton h-2.5 w-10 rounded" />
                    <div class="skeleton h-3.5 w-full rounded" />
                  </div>
                </div>
              </div>
            </div>
            <div class="overflow-x-auto" :class="mobileCards ? 'hidden md:block' : 'block'">
              <table class="table">
                <thead>
                  <tr class="bg-base-200/50 border-base-content/10 border-b">
                    <th v-for="c in desktopColumns" :key="c.id" class="text-base-content/50 text-xs font-semibold tracking-wider uppercase">
                      <div class="skeleton h-3 w-16 rounded" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="sk in skeletonRows" :key="sk" class="border-base-content/5 border-b">
                    <td v-for="c in desktopColumns" :key="c.id"><div class="skeleton h-4 w-full rounded" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Muat lebih banyak -->
        <div v-if="pagination === 'load-more' && loadMoreButton && meta.hasMore && hasData" class="flex flex-col items-center gap-2 py-4">
          <p class="text-base-content/40 text-xs">{{ t('pagination.showing', { count: rows.length }) }}</p>
          <button type="button" class="btn btn-sm btn-outline btn-primary gap-1.5" :disabled="busy" @click="table.loadMore()">
            <span v-if="busy" class="loading loading-spinner loading-xs" />
            <span v-else>{{ t('action.loadMore') }}</span>
          </button>
        </div>

        <!-- Pagination -->
        <div
          v-if="pagination === 'pages' && hasData"
          class="border-base-content/5 bg-base-100 mt-3 rounded-xl border-t px-4 py-3 shadow-sm md:mt-0 md:rounded-none md:border-t md:bg-transparent md:shadow-none"
          :class="[bordered && 'p-4', busy && 'invisible']"
        >
          <TablePagination :table="table" />
        </div>
      </div>
    </div>

    <!-- Petunjuk keyboard -->
    <div v-if="showKeyboardHint && keyboardNav && hasData" class="text-base-content/15 mt-2 flex flex-wrap items-center justify-center gap-3 text-[10px]">
      <span class="inline-flex items-center gap-[3px]"><kbd class="kbd kbd-xs text-base-content/20 font-semibold">&#8593;&#8595;</kbd> {{ t('keyboard.navigate') }}</span>
      <span v-if="onEdit" class="inline-flex items-center gap-[3px]"><kbd class="kbd kbd-xs text-base-content/20 font-semibold">Enter</kbd> {{ t('keyboard.edit') }}</span>
      <span v-if="onDelete" class="inline-flex items-center gap-[3px]"><kbd class="kbd kbd-xs text-base-content/20 font-semibold">Del/&#9003;</kbd> {{ t('keyboard.delete') }}</span>
      <span class="inline-flex items-center gap-[3px]"><kbd class="kbd kbd-xs text-base-content/20 font-semibold">Esc</kbd> {{ t('keyboard.cancel') }}</span>
    </div>

    <!-- ========== MODAL ========== -->
    <MrcConfirm
      v-model:open="resetOpen"
      :title="t('confirm.resetTitle')"
      :description="t('confirm.resetDesc')"
      :confirm-label="t('action.yesReset')"
      icon="restart_alt"
      tone="warning"
      @confirm="doReset"
    />
    <MrcConfirm
      v-if="onBulkDelete"
      v-model:open="bulkDeleteOpen"
      :title="t('bulk.deleteTitle')"
      :description="t('bulk.deleteDesc')"
      icon="delete_sweep"
      :loading="bulkBusy"
      @confirm="runBulkDelete"
    />
    <BulkActionModal
      v-if="activeBulk && activeBulk.mode !== 'instant'"
      v-model:values="bulkValues"
      v-model:errors="bulkErrors"
      :action="activeBulk"
      :count="table.selectedRows.value.length"
      :busy="bulkBusy"
      @submit="runBulk"
      @cancel="activeBulk = null"
    >
      <template v-for="f in (activeBulk.fields ?? []).filter((x) => x.type === 'slot')" :key="f.name" #[`field-${f.name}`]="scope">
        <slot :name="`bulk-field-${activeBulk.id}-${f.name}`" v-bind="scope" />
      </template>
    </BulkActionModal>
    <ExportModal
      v-if="exportable"
      v-model:open="exportOpen"
      :table="table"
      :title="title ?? entity ?? name ?? 'Data'"
      :options="exportOpts"
    />

    <!-- Bottom-sheet mobile -->
    <template v-if="mobileCards">
      <MrcModal v-model:open="mobilePresetOpen" :title="t('filter.preset')" icon="bookmarks" size="md" box-class="sm:hidden" body-class="space-y-2">
        <PresetMenu :table="table" @applied="mobilePresetOpen = false" />
      </MrcModal>
      <MrcModal v-model:open="mobileColumnsOpen" :title="t('column.toggle')" icon="view_column" size="md" box-class="sm:hidden" body-class="max-h-[60vh] overflow-y-auto">
        <ColumnMenu :table="table" sheet />
      </MrcModal>
      <MrcModal v-if="expandMobile" v-model:open="mobileExpandOpen" :title="t('action.details')" icon="info" size="md" box-class="md:hidden">
        <template v-if="mobileExpandRow">
          <slot name="expand" :row="mobileExpandRow">
            <MrcExpandFields v-if="expandContent(mobileExpandRow)" :row="mobileExpandRow" :fields="expandContent(mobileExpandRow)!" />
          </slot>
        </template>
      </MrcModal>
    </template>

    <!-- Overlay layar penuh (pengganti `$withLoading`) -->
    <Teleport to="body">
      <div
        v-if="loadingOverlay === 'fullscreen' && busy"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
        role="status"
        aria-live="polite"
      >
        <div class="flex flex-col items-center gap-3">
          <span class="loading loading-dots loading-xl text-primary" />
          <span class="text-sm font-medium text-white">{{ t(table.isLoading.value ? 'loading' : 'processing') }}</span>
        </div>
      </div>
    </Teleport>
  </div>
</template>
