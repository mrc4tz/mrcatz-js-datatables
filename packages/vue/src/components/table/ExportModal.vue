<script setup lang="ts">
/** Modal export: pilih format & cakupan, opsional sertakan kondisi aktif. */
import { computed, ref, watch } from 'vue';
import { formatSort, type TableQuery } from '@mrcatz/datatable-core';
import { useMrcatz } from '../../config';
import type { DataTableController } from '../../composables/useDataTable';
import { buildExportTable, downloadCsv, printTable, type ExportFormat, type ExportScope } from '../../export';
import MrcModal from '../MrcModal.vue';
import MrcIcon from '../MrcIcon.vue';

const props = defineProps<{
  table: DataTableController<any>;
  title: string;
  filename?: string;
  formats?: ExportFormat[];
}>();
const open = defineModel<boolean>('open', { default: false });
const { t, notify, dateLocale } = useMrcatz();

const format = ref<ExportFormat>(props.formats?.[0] ?? 'csv');
const scope = ref<ExportScope>('filtered');
const includeConditions = ref(false);
const busy = ref(false);
const allTotal = ref<number | null>(null);

const selectedCount = computed(() => props.table.selectedRows.value.length);
const hiddenCount = computed(() => props.table.state.hidden.length);

const conditions = computed(() => {
  const out: string[] = [];
  const s = props.table.state;
  if (s.search) out.push(`${t('search.submit')}: ${s.search}`);
  for (const f of props.table.filters.value) {
    const v = s.filters[f.id];
    if (!v) continue;
    const label = (x: unknown) => f.options?.find((o) => String(o.value) === String(x))?.label ?? String(x);
    const text =
      typeof v === 'string' ? label(v) : 'values' in v ? `${v.exclude ? t('filter.notPrefix') : ''}${v.values.map(label).join(', ')}` : `${v.from ?? '…'} – ${v.to ?? '…'}`;
    out.push(`${f.label}: ${text}`);
  }
  if (s.sort.length) out.push(`${t('export.sort')}: ${formatSort(s.sort)}`);
  return out;
});

watch(open, async (v) => {
  if (!v) return;
  scope.value = selectedCount.value ? 'selected' : 'filtered';
  allTotal.value = null;
  try {
    const page = await props.table.source.value.fetch({ page: 1, limit: 1, search: '', sort: [], filters: {} });
    allTotal.value = page.meta.total;
  } catch {
    allTotal.value = null;
  }
});

const count = computed(() =>
  scope.value === 'selected' ? selectedCount.value : scope.value === 'all' ? allTotal.value : props.table.meta.value.total,
);

async function fetchAll(q: TableQuery): Promise<unknown[]> {
  const src = props.table.source.value;
  if (src.fetchAll) return src.fetchAll(q);
  const out: unknown[] = [];
  for (let page = 1; ; page++) {
    const res = await src.fetch({ ...q, page, limit: 100 });
    out.push(...res.data);
    if (page >= res.meta.totalPages || res.data.length === 0) break;
  }
  return out;
}

async function run() {
  busy.value = true;
  try {
    const q = props.table.query.value;
    const rows =
      scope.value === 'selected'
        ? props.table.selectedRows.value
        : await fetchAll(scope.value === 'all' ? { ...q, search: '', filters: {}, page: 1 } : { ...q, page: 1 });
    const data = buildExportTable(props.table.visibleColumns.value, rows);
    const conds = includeConditions.value && scope.value === 'filtered' ? conditions.value : undefined;
    const stamp = new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());
    const name = props.filename ?? (props.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export');

    if (format.value === 'csv') downloadCsv(data, `${name}-${new Date().toISOString().slice(0, 10)}`, { conditions: conds });
    else printTable(data, props.title, { conditions: conds, footer: `${t('export.exportedAt')}: ${stamp} · ${data.rows.length}` });
    open.value = false;
  } catch (e) {
    notify('error', e instanceof Error ? e.message : t('crud.failed'));
  } finally {
    busy.value = false;
  }
}

const scopes = computed(() =>
  [
    { id: 'filtered' as const, label: t('export.filtered'), desc: t('export.filteredDesc') },
    { id: 'all' as const, label: t('export.all'), desc: t('export.allDesc') },
    ...(selectedCount.value ? [{ id: 'selected' as const, label: t('export.selected'), desc: t('export.selectedDesc', { count: selectedCount.value }) }] : []),
  ],
);
</script>

<template>
  <MrcModal v-model:open="open" :title="t('export.title')" :subtitle="title" size="sm" :dismissible="!busy">
    <div class="flex flex-col gap-4">
      <fieldset class="fieldset">
        <legend class="fieldset-legend">{{ t('export.format') }}</legend>
        <div class="grid grid-cols-2 gap-2">
          <label
            v-for="f in formats ?? ['csv', 'pdf']"
            :key="f"
            class="border-base-content/15 has-checked:border-primary has-checked:bg-primary/5 flex cursor-pointer items-center gap-2 rounded-field border p-2.5 text-sm"
          >
            <input v-model="format" type="radio" :value="f" class="radio radio-xs radio-primary" />
            <MrcIcon :name="f === 'csv' ? 'file' : 'printer'" :size="15" />
            {{ t(`export.${f}`) }}
          </label>
        </div>
      </fieldset>

      <fieldset class="fieldset">
        <legend class="fieldset-legend">{{ t('export.scope') }}</legend>
        <label
          v-for="s in scopes"
          :key="s.id"
          class="border-base-content/15 has-checked:border-primary has-checked:bg-primary/5 flex cursor-pointer items-start gap-2 rounded-field border p-2.5"
        >
          <input v-model="scope" type="radio" :value="s.id" class="radio radio-xs radio-primary mt-0.5" />
          <span class="flex flex-col">
            <span class="text-sm font-medium">{{ s.label }}</span>
            <span class="text-base-content/60 text-xs">{{ s.desc }}</span>
          </span>
        </label>
      </fieldset>

      <label v-if="scope === 'filtered'" class="flex items-center gap-2 text-sm" :class="{ 'opacity-50': !conditions.length }">
        <input v-model="includeConditions" type="checkbox" class="toggle toggle-sm toggle-primary" :disabled="!conditions.length" />
        {{ t('export.includeConditions') }}
      </label>

      <div class="bg-base-200/60 rounded-field px-3 py-2 text-xs">
        <p class="font-medium">{{ count === null ? '…' : t('export.count', { count: count.toLocaleString() }) }}</p>
        <p v-if="hiddenCount" class="text-base-content/60">{{ t('export.hiddenColumns', { count: hiddenCount }) }}</p>
      </div>
    </div>

    <template #footer>
      <button type="button" class="btn btn-ghost btn-sm" :disabled="busy" @click="open = false">{{ t('action.cancel') }}</button>
      <button type="button" class="btn btn-primary btn-sm" :disabled="busy || count === 0" @click="run">
        <span v-if="busy" class="loading loading-spinner loading-xs" />
        <MrcIcon v-else name="download" :size="15" />
        {{ busy ? t('export.processing') : t('action.export') }}
      </button>
    </template>
  </MrcModal>
</template>
