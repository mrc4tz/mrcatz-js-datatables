import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, reactive, ref, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue';
import {
  getPath,
  isEmptyFilterValue,
  isTableParam,
  parseTableQuery,
  toSearchParams,
  type FilterSchema,
  type FilterType,
  type FilterValue,
  type SortRule,
  type TablePage,
  type TableQuery,
} from '@mrcatz/datatable-core';
import type { ColumnDef } from '../columns';
import type { DataSource } from '../sources';
import { useUrlState } from './useUrlState';

export type PaginationMode = 'pages' | 'load-more' | false;
export type RowKey<T> = string | ((row: T) => string | number);

export interface UseDataTableOptions<T> {
  source: MaybeRefOrGetter<DataSource<T>>;
  columns: MaybeRefOrGetter<ColumnDef<T>[]>;
  /**
   * Nama tabel: namespace untuk URL (`{name}_search`), cache, dan preset.
   * Wajib unik bila ada beberapa tabel di satu halaman (pengganti `setPageName`).
   */
  name?: string;
  perPageOptions?: number[];
  defaultSort?: SortRule[];
  /** Schema filter statis; bila kosong diambil dari `source.schema()`. */
  filters?: MaybeRefOrGetter<FilterSchema[] | undefined>;
  pagination?: PaginationMode;
  /** Simpan state di query string agar bisa dibagikan/di-bookmark. Default true. */
  syncUrl?: boolean;
  rowKey?: RowKey<T>;
  /** Waktu cache data (ms). Default 0 = selalu segar saat kembali ke halaman. */
  staleTime?: number;
}

const LAYOUT_HIDE = 'cols.hide';
const LAYOUT_ORDER = 'cols.order';

export function useDataTable<T>(opts: UseDataTableOptions<T>) {
  const name = opts.name ?? '';
  const prefix = name ? `${name}_` : '';
  const perPageOptions = opts.perPageOptions ?? [10, 25, 50, 100];
  const baseLimit = perPageOptions[0] ?? 10;
  const pagination = opts.pagination ?? 'pages';
  const url = opts.syncUrl === false ? null : useUrlState();
  const queryClient = useQueryClient();

  const columns = computed(() => toValue(opts.columns));
  const defaultHidden = () => columns.value.filter((c) => c.hidden).map((c) => c.id);

  // ---------------------------------------------------------------- state
  const state = reactive({
    search: '',
    page: 1,
    limit: baseLimit,
    /** Mode load-more: berapa "halaman" yang sudah dimuat. */
    loaded: 1,
    sort: [] as SortRule[],
    filters: {} as Record<string, FilterValue>,
    hidden: defaultHidden(),
    order: [] as string[],
    widths: {} as Record<string, number>,
  });

  /** Isi kotak pencarian (belum tentu sudah diterapkan). */
  const searchInput = ref('');

  // Pulihkan dari URL (deep link) sebelum query pertama.
  if (url) {
    const raw = url.read();
    const q = parseTableQuery(raw, { prefix, defaultLimit: baseLimit, maxLimit: 10_000 });
    Object.assign(state, {
      search: q.search,
      page: q.page,
      limit: perPageOptions.includes(q.limit) ? q.limit : baseLimit,
      sort: q.sort,
      filters: q.filters,
    });
    searchInput.value = q.search;
    const pick = (k: string) => {
      const v = raw[`${prefix}${k}`];
      return (Array.isArray(v) ? v.join(',') : (v ?? '')).split(',').filter(Boolean);
    };
    const ids = new Set(columns.value.map((c) => c.id));
    const hide = pick(LAYOUT_HIDE).filter((id) => ids.has(id));
    if (raw[`${prefix}${LAYOUT_HIDE}`] !== undefined) state.hidden = hide;
    state.order = pick(LAYOUT_ORDER).filter((id) => ids.has(id));
  }

  const query = computed<TableQuery>(() => ({
    search: state.search,
    page: pagination === 'load-more' ? 1 : state.page,
    limit: pagination === 'load-more' ? state.limit * state.loaded : pagination === false ? 10_000 : state.limit,
    sort: state.sort.length ? state.sort : (opts.defaultSort ?? []),
    filters: state.filters,
  }));

  // Tulis ke URL setiap state berubah.
  if (url) {
    const owned = (k: string) =>
      isTableParam(k, prefix) || k === `${prefix}${LAYOUT_HIDE}` || k === `${prefix}${LAYOUT_ORDER}`;
    watch(
      () => [state.search, state.page, state.limit, state.sort, state.filters, state.hidden, state.order],
      () => {
        const params = toSearchParams(
          { search: state.search, page: state.page, limit: state.limit, sort: state.sort, filters: state.filters },
          { prefix, defaults: { page: 1, limit: baseLimit } },
        );
        const hiddenChanged = [...state.hidden].sort().join(',') !== defaultHidden().sort().join(',');
        if (hiddenChanged) params.set(`${prefix}${LAYOUT_HIDE}`, state.hidden.join(','));
        if (state.order.length) params.set(`${prefix}${LAYOUT_ORDER}`, state.order.join(','));
        url.write(owned, params);
      },
      { deep: true },
    );
  }

  // ---------------------------------------------------------------- data
  const sourceKey = computed(() => toValue(opts.source).key);
  const dataQuery = useQuery({
    queryKey: computed(() => ['mrcatz', sourceKey.value, name, query.value] as const),
    queryFn: ({ signal }) => toValue(opts.source).fetch(query.value, signal),
    placeholderData: keepPreviousData,
    staleTime: opts.staleTime ?? 0,
  });

  const page = computed<TablePage<T> | undefined>(() => dataQuery.data.value);
  const rows = computed<T[]>(() => page.value?.data ?? []);
  const meta = computed(
    () => page.value?.meta ?? { total: 0, page: state.page, limit: state.limit, totalPages: 1, hasMore: false },
  );

  // ---------------------------------------------------------------- schema filter
  const staticFilters = computed(() => toValue(opts.filters));
  const dependencyIds = ref<string[]>([]);
  const schemaQuery = useQuery({
    queryKey: computed(
      () =>
        [
          'mrcatz-schema',
          sourceKey.value,
          name,
          Object.fromEntries(dependencyIds.value.map((id) => [id, state.filters[id] ?? null])),
        ] as const,
    ),
    queryFn: ({ signal }) => toValue(opts.source).schema!(query.value, signal),
    enabled: computed(() => !staticFilters.value && !!toValue(opts.source).schema),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const filters = computed<FilterSchema[]>(() => staticFilters.value ?? schemaQuery.data.value?.filters ?? []);
  watch(
    filters,
    (list) => {
      dependencyIds.value = [...new Set(list.flatMap((f) => f.dependsOn ?? []))].sort();
    },
    { immediate: true },
  );
  const filterTypes = computed(
    () => Object.fromEntries(filters.value.map((f) => [f.id, f.type])) as Record<string, FilterType>,
  );
  // Filter multi dengan satu nilai dari URL ter-parse sebagai string sebelum schema tiba.
  watch(filterTypes, (types) => {
    const next = { ...state.filters };
    let changed = false;
    for (const [id, v] of Object.entries(next)) {
      if (types[id] === 'multi' && typeof v === 'string') {
        next[id] = { values: [v] };
        changed = true;
      }
    }
    if (changed) state.filters = next;
  });

  // ---------------------------------------------------------------- columns
  const orderedColumns = computed(() => {
    const list = columns.value;
    if (!state.order.length) return list;
    const pos = new Map(state.order.map((id, i) => [id, i]));
    return list
      .map((c, i) => ({ c, i }))
      .sort((a, b) => (pos.get(a.c.id) ?? 1e6 + a.i) - (pos.get(b.c.id) ?? 1e6 + b.i))
      .map((x) => x.c);
  });
  const visibleColumns = computed(() => orderedColumns.value.filter((c) => !state.hidden.includes(c.id)));

  // ---------------------------------------------------------------- selection
  const keyOf = (row: T): string => {
    const rk = opts.rowKey ?? 'id';
    return String(typeof rk === 'function' ? rk(row) : getPath(row, rk));
  };
  const selected = shallowRef(new Map<string, T>());
  const selectedRows = computed(() => [...selected.value.values()]);
  const isSelected = (row: T) => selected.value.has(keyOf(row));

  function setSelection(next: Map<string, T>) {
    selected.value = next;
  }
  function toggleRow(row: T, on?: boolean) {
    const next = new Map(selected.value);
    const k = keyOf(row);
    if (on ?? !next.has(k)) next.set(k, row);
    else next.delete(k);
    setSelection(next);
  }
  function togglePage(selectable: (row: T) => boolean = () => true) {
    const candidates = rows.value.filter(selectable);
    const all = candidates.length > 0 && candidates.every(isSelected);
    const next = new Map(selected.value);
    for (const r of candidates) all ? next.delete(keyOf(r)) : next.set(keyOf(r), r);
    setSelection(next);
  }
  function clearSelection() {
    if (selected.value.size) setSelection(new Map());
  }

  // ---------------------------------------------------------------- actions
  /** Perubahan kriteria (bukan navigasi halaman) → kembali ke halaman 1 & kosongkan seleksi. */
  function criteriaChanged() {
    state.page = 1;
    state.loaded = 1;
    clearSelection();
  }

  function applySearch(value = searchInput.value) {
    const v = value.trim();
    searchInput.value = v;
    if (v === state.search) return;
    state.search = v;
    criteriaChanged();
  }

  /**
   * Klik header (sama dengan `orderData()` versi Laravel): kolom yang belum
   * diurutkan → DESC, lalu bergantian ASC/DESC. Dengan `multi` (Shift+klik),
   * kolom ditambahkan ke urutan bertingkat (`addSort()`), urutan utama yang
   * sedang aktif ikut dipertahankan sebagai prioritas pertama.
   */
  function toggleSort(key: string, multi = false) {
    const current = state.sort.find((s) => s.key === key);
    const nextDir: 'asc' | 'desc' = current?.dir === 'desc' ? 'asc' : 'desc';
    if (multi) {
      state.sort = current ? state.sort.map((s) => (s.key === key ? { key, dir: nextDir } : s)) : [...state.sort, { key, dir: nextDir }];
    } else {
      state.sort = [{ key, dir: nextDir }];
    }
    state.page = 1;
    state.loaded = 1;
  }

  function sortOf(key: string): { dir: 'asc' | 'desc'; priority: number } | null {
    const i = state.sort.findIndex((s) => s.key === key);
    return i < 0 ? null : { dir: state.sort[i]!.dir, priority: state.sort.length > 1 ? i + 1 : 0 };
  }

  /** Kosongkan filter turunan (yang `dependsOn` filter ini), berantai. */
  function clearDependents(id: string, seen = new Set<string>()) {
    for (const f of filters.value) {
      if (f.dependsOn?.includes(id) && !seen.has(f.id)) {
        seen.add(f.id);
        delete state.filters[f.id];
        clearDependents(f.id, seen);
      }
    }
  }

  function setFilter(id: string, value: FilterValue | undefined | null) {
    const next = { ...state.filters };
    if (value === undefined || value === null || isEmptyFilterValue(value)) delete next[id];
    else next[id] = value;
    state.filters = next;
    clearDependents(id);
    criteriaChanged();
  }

  function clearFilters() {
    state.filters = {};
    criteriaChanged();
  }

  /** Kembalikan semua ke bawaan: pencarian, filter, urutan, tata letak (pengganti `resetData`). */
  function reset() {
    searchInput.value = '';
    Object.assign(state, {
      search: '',
      sort: [],
      filters: {},
      hidden: defaultHidden(),
      order: [],
      widths: {},
      limit: baseLimit,
    });
    criteriaChanged();
  }

  function goToPage(p: number) {
    state.page = Math.min(Math.max(1, p), Math.max(1, meta.value.totalPages));
  }

  function setLimit(limit: number) {
    state.limit = limit;
    criteriaChanged();
  }

  function loadMore() {
    state.loaded += 1;
  }

  function toggleColumn(id: string) {
    state.hidden = state.hidden.includes(id) ? state.hidden.filter((x) => x !== id) : [...state.hidden, id];
  }

  function moveColumn(id: string, toIndex: number) {
    const ids = orderedColumns.value.map((c) => c.id);
    const from = ids.indexOf(id);
    if (from < 0) return;
    ids.splice(from, 1);
    ids.splice(Math.max(0, Math.min(toIndex, ids.length)), 0, id);
    state.order = ids;
  }

  /** Pindahkan kolom ke posisi kolom lain (drag & drop header). */
  function moveColumnTo(id: string, targetId: string) {
    if (id === targetId) return;
    const ids = orderedColumns.value.map((c) => c.id);
    moveColumn(id, ids.indexOf(targetId));
  }

  function setWidth(id: string, width: number) {
    state.widths = { ...state.widths, [id]: Math.max(48, Math.round(width)) };
  }

  /** Muat ulang data & schema (pengganti `refreshData` / event `refreshDataTable`). */
  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['mrcatz', sourceKey.value, name] });
    await queryClient.invalidateQueries({ queryKey: ['mrcatz-schema', sourceKey.value, name] });
  }

  /** Terapkan state tersimpan (preset). */
  function applyState(next: Partial<Pick<TableQuery, 'search' | 'sort' | 'filters'>>) {
    if (next.search !== undefined) {
      state.search = next.search;
      searchInput.value = next.search;
    }
    if (next.sort) state.sort = next.sort;
    if (next.filters) state.filters = { ...next.filters };
    criteriaChanged();
  }

  const activeFilterCount = computed(() => Object.values(state.filters).filter((v) => !isEmptyFilterValue(v)).length);
  const isDirty = computed(
    () =>
      !!state.search ||
      activeFilterCount.value > 0 ||
      state.sort.length > 0 ||
      state.order.length > 0 ||
      Object.keys(state.widths).length > 0 ||
      [...state.hidden].sort().join() !== defaultHidden().sort().join(),
  );

  return {
    name,
    state,
    searchInput,
    query,
    perPageOptions,
    pagination,
    // data
    rows,
    meta,
    isLoading: dataQuery.isLoading,
    isFetching: dataQuery.isFetching,
    error: dataQuery.error,
    // schema
    filters,
    filterTypes,
    filtersLoading: schemaQuery.isFetching,
    // columns
    columns,
    orderedColumns,
    visibleColumns,
    // selection
    keyOf,
    selected,
    selectedRows,
    isSelected,
    toggleRow,
    togglePage,
    clearSelection,
    // actions
    applySearch,
    toggleSort,
    sortOf,
    setFilter,
    clearFilters,
    reset,
    goToPage,
    setLimit,
    loadMore,
    toggleColumn,
    moveColumn,
    moveColumnTo,
    setWidth,
    refresh,
    applyState,
    activeFilterCount,
    isDirty,
    source: computed(() => toValue(opts.source)),
  };
}

export type DataTableController<T> = ReturnType<typeof useDataTable<T>>;
