<script setup lang="ts">
/**
 * Modal export (pengganti modal export di `partials/modals.blade.php`):
 * format PDF/CSV/Excel, cakupan Semua/Sesuai Filter, pratinjau kondisi aktif,
 * jumlah data, dan indikator proses di pojok kanan bawah.
 * Bila ada baris terpilih, cakupan "Sesuai Filter" hanya mengekspor pilihan itu.
 */
import { computed, ref, watch } from 'vue';
import type { TableQuery } from '@mrcatz/datatable-core';
import { useMrcatz } from '../../config';
import type { DataTableController } from '../../composables/useDataTable';
import { buildExportTable, downloadCsv, downloadXlsx, printTable, type ExportFormat } from '../../export';
import type { IconName } from '../../icons';
import MrcIcon from '../MrcIcon.vue';
import MrcModal from '../MrcModal.vue';

const props = defineProps<{
  table: DataTableController<any>;
  title: string;
  filename?: string;
  formats?: ExportFormat[];
}>();
const open = defineModel<boolean>('open', { default: false });
const { t, notify, dateLocale } = useMrcatz();

const format = ref<ExportFormat>('pdf');
const scope = ref<'all' | 'filtered'>('filtered');
const includeConditions = ref(true);
const busy = ref<ExportFormat | null>(null);
const allTotal = ref<number | null>(null);

const formatCards = computed(() =>
  (
    [
      { id: 'pdf', label: 'PDF', ext: '.pdf', icon: 'picture_as_pdf', color: 'text-error' },
      { id: 'csv', label: 'CSV', ext: '.csv', icon: 'description', color: 'text-info' },
      { id: 'excel', label: 'Excel', ext: '.xlsx', icon: 'table_view', color: 'text-success' },
    ] as const
  ).filter((f) => !props.formats || props.formats.includes(f.id)),
);

const selected = computed(() => props.table.selectedRows.value);

/** Sama dengan `buildExportPreview()` versi Laravel. */
const preview = computed(() => {
  const s = props.table.state;
  const out: Array<{ icon: IconName; label: string; value: string }> = [];
  if (s.search) out.push({ icon: 'search', label: t('export.search'), value: s.search });
  for (const f of props.table.filters.value) {
    const v = s.filters[f.id];
    if (!v) continue;
    const label = (x: unknown) => f.options?.find((o) => String(o.value) === String(x))?.label ?? String(x);
    if (typeof v === 'string') out.push({ icon: f.type === 'date' ? 'event' : 'filter_alt', label: f.label, value: f.type === 'date' ? v : label(v) });
    else if ('values' in v) {
      if (!v.values.length) continue;
      const joined = v.values.map(label).join(', ');
      out.push({ icon: 'check_box', label: f.label, value: v.exclude ? `${t('filter.notPrefix')}(${joined})` : joined });
    } else if (v.from || v.to) out.push({ icon: 'event', label: f.label, value: `${v.from ?? '...'}  →  ${v.to ?? '...'}` });
  }
  if (s.sort.length) {
    const key = (k: string) => k.split('.').pop()!;
    out.push({ icon: 'sort', label: t('export.previewSort'), value: s.sort.map((x) => `${key(x.key)} ${x.dir.toUpperCase()}`).join(', ') });
  }
  if (s.hidden.length) out.push({ icon: 'visibility_off', label: t('column.toggle'), value: t('export.previewHidden', { count: s.hidden.length }) });
  if (selected.value.length) out.push({ icon: 'checklist', label: t('export.previewBulk'), value: `${selected.value.length} ${t('bulk.selected')}` });
  return out;
});
const hasConditions = computed(() => preview.value.length > 0);

watch(open, async (v) => {
  if (!v) return;
  format.value = formatCards.value[0]?.id ?? 'pdf';
  scope.value = 'filtered';
  allTotal.value = null;
  try {
    const page = await props.table.source.value.fetch({ page: 1, limit: 1, search: '', sort: [], filters: {} });
    allTotal.value = page.meta.total;
  } catch {
    allTotal.value = null;
  }
});

const count = computed(() =>
  scope.value === 'all' ? allTotal.value : selected.value.length ? selected.value.length : props.table.meta.value.total,
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
  const fmt = format.value;
  const sc = scope.value;
  const conds =
    sc === 'filtered' && hasConditions.value && includeConditions.value
      ? [t('export.conditionsBanner'), ...preview.value.map((p) => `${p.label}: ${p.value}`)]
      : undefined;
  open.value = false;
  busy.value = fmt;
  try {
    const q = props.table.query.value;
    const rows =
      sc === 'filtered' && selected.value.length
        ? selected.value
        : await fetchAll(sc === 'all' ? { ...q, search: '', filters: {}, page: 1 } : { ...q, page: 1 });
    const data = buildExportTable(props.table.visibleColumns.value, rows);
    const name = props.filename ?? (props.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export');
    const file = `${name}-${new Date().toISOString().slice(0, 10)}`;
    const stamp = new Intl.DateTimeFormat(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date());

    if (fmt === 'csv') downloadCsv(data, file, { conditions: conds });
    else if (fmt === 'excel') downloadXlsx(data, file, { conditions: conds, sheetName: props.title });
    else
      printTable(data, props.title, {
        conditions: conds,
        footer: `${t('export.bannerExported')}: ${stamp} · ${t('export.bannerTotal')}: ${data.rows.length} ${t('export.bannerRows')}`,
      });
  } catch (e) {
    notify('error', e instanceof Error ? e.message : t('crud.failed'));
  } finally {
    busy.value = null;
  }
}

const busyCfg = {
  pdf: { icon: 'picture_as_pdf', soft: 'bg-error/10', ping: 'bg-error/20', text: 'text-error', label: 'PDF' },
  csv: { icon: 'description', soft: 'bg-info/10', ping: 'bg-info/20', text: 'text-info', label: 'CSV' },
  excel: { icon: 'table_view', soft: 'bg-success/10', ping: 'bg-success/20', text: 'text-success', label: 'Excel' },
} as const;
</script>

<template>
  <MrcModal v-model:open="open" :title="t('export.title')" icon="download" size="md" body-class="max-h-[65vh] overflow-y-auto pr-1 -mr-1 space-y-5">
    <div>
      <label class="text-base-content/60 mb-2 block text-xs font-semibold tracking-wide uppercase">{{ t('export.format') }}</label>
      <div class="grid gap-2" :class="formatCards.length === 3 ? 'grid-cols-3' : 'grid-cols-2'">
        <label
          v-for="f in formatCards"
          :key="f.id"
          class="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all"
          :class="format === f.id ? 'border-primary bg-primary/5' : 'border-base-content/10 hover:bg-base-200/50'"
          @click="format = f.id"
        >
          <MrcIcon :name="f.icon" :size="24" :class="f.color" />
          <div>
            <p class="text-base-content text-sm font-semibold">{{ f.label }}</p>
            <p class="text-base-content/40 text-xs">{{ f.ext }}</p>
          </div>
        </label>
      </div>
    </div>

    <div>
      <label class="text-base-content/60 mb-2 block text-xs font-semibold tracking-wide uppercase">{{ t('export.scope') }}</label>
      <div class="grid grid-cols-2 gap-2">
        <label
          class="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all"
          :class="scope === 'all' ? 'border-primary bg-primary/5' : 'border-base-content/10 hover:bg-base-200/50'"
          @click="scope = 'all'"
        >
          <MrcIcon name="select_all" :class="scope === 'all' ? 'text-primary' : 'text-base-content/30'" />
          <div>
            <p class="text-base-content text-sm font-semibold">{{ t('export.all') }}</p>
            <p class="text-base-content/40 text-xs">{{ t('export.allDesc') }}</p>
          </div>
        </label>
        <label
          class="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all"
          :class="scope === 'filtered' ? 'border-primary bg-primary/5' : 'border-base-content/10 hover:bg-base-200/50'"
          @click="scope = 'filtered'"
        >
          <MrcIcon name="filter_alt" :class="scope === 'filtered' ? 'text-primary' : 'text-base-content/30'" />
          <div>
            <p class="text-base-content text-sm font-semibold">{{ t('export.filtered') }}</p>
            <p class="text-base-content/40 text-xs">{{ t('export.filteredDesc') }}</p>
          </div>
        </label>
      </div>
    </div>

    <Transition enter-active-class="transition ease-out duration-200" enter-from-class="opacity-0 -translate-y-2">
      <div v-if="scope === 'filtered'">
        <div class="bg-base-200/40 space-y-2 rounded-xl p-4">
          <p class="text-base-content/50 flex items-center gap-1 text-xs font-semibold tracking-wide uppercase">
            <MrcIcon name="tune" :size="14" />
            {{ t('export.previewTitle') }}
          </p>
          <div v-for="(item, i) in preview" :key="i" class="flex items-center gap-2 py-1">
            <MrcIcon :name="item.icon" :size="16" class="text-base-content/40 shrink-0" />
            <span class="text-base-content/50 shrink-0 text-xs">{{ item.label }}</span>
            <span class="text-base-content truncate text-xs font-medium">{{ item.value }}</span>
          </div>
          <p v-if="!preview.length" class="text-base-content/40 py-1 text-xs italic">{{ t('export.previewEmpty') }}</p>

          <label
            class="border-base-content/5 mt-2 flex items-center gap-2 border-t pt-3"
            :class="hasConditions ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'"
          >
            <input
              type="checkbox"
              class="checkbox checkbox-primary checkbox-xs"
              :disabled="!hasConditions"
              :checked="hasConditions && includeConditions"
              @change="includeConditions = ($event.target as HTMLInputElement).checked"
            />
            <span class="flex flex-col leading-tight">
              <span class="text-base-content text-xs font-medium">{{ t('export.conditionsToggle') }}</span>
              <span v-if="!hasConditions" class="text-base-content/40 text-[10px] italic">{{ t('export.conditionsHint') }}</span>
            </span>
          </label>
        </div>
      </div>
    </Transition>

    <div class="bg-base-200/40 mt-4 flex items-center gap-2 rounded-xl p-3">
      <MrcIcon name="info" :size="16" class="text-base-content/40" />
      <p class="text-base-content/60 text-sm">
        <span v-if="count !== null" class="text-base-content font-semibold">{{ count.toLocaleString('id-ID') }}</span>
        <span v-else class="loading loading-spinner loading-xs" />
        {{ t('export.count') }}
      </p>
    </div>

    <template #footer>
      <button type="button" class="btn btn-primary gap-2 px-6 shadow-sm" :disabled="count === 0" @click="run">
        <MrcIcon name="download" />
        {{ t('action.export') }}
      </button>
      <button type="button" class="btn btn-ghost" @click="open = false">{{ t('action.cancel') }}</button>
    </template>
  </MrcModal>

  <Teleport to="body">
    <div
      v-if="busy"
      class="bg-base-100 border-base-content/10 fixed right-6 bottom-6 z-[60] flex w-[22rem] max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border p-4 shadow-2xl"
      role="status"
      aria-live="polite"
    >
      <div class="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl" :class="busyCfg[busy].soft">
        <MrcIcon :name="busyCfg[busy].icon" :size="24" :class="busyCfg[busy].text" />
        <span class="absolute inset-0 animate-ping rounded-xl opacity-30" :class="busyCfg[busy].ping" />
      </div>
      <div class="min-w-0 flex-1 leading-tight">
        <p class="text-base-content truncate text-sm font-semibold">{{ t('export.processingTitle', { format: busyCfg[busy].label }) }}</p>
        <p class="text-base-content/50 mt-0.5 truncate text-xs">{{ t('export.processingSubtitle') }}</p>
      </div>
      <span class="loading loading-spinner loading-sm shrink-0" :class="busyCfg[busy].text" />
    </div>
  </Teleport>
</template>
