<script setup lang="ts">
/** Chip filter aktif + tombol hapus per filter — terlihat walau panel ditutup. */
import { computed } from 'vue';
import { isEmptyFilterValue, type FilterSchema, type FilterValue } from '@mrcatz/datatable-core';
import { useMrcatz } from '../../config';
import type { DataTableController } from '../../composables/useDataTable';
import MrcIcon from '../MrcIcon.vue';
import { formatDateValue } from './dateUtils';

const props = defineProps<{ table: DataTableController<any> }>();
const { t, dateLocale } = useMrcatz();

function describe(f: FilterSchema, v: FilterValue): string {
  const label = (x: string) => f.options?.find((o) => String(o.value) === String(x))?.label ?? x;
  if (typeof v === 'string') return f.type === 'date' ? formatDateValue(v, f.format, dateLocale) : label(v);
  if ('values' in v) {
    const names = v.values.map(label);
    const text = names.length > 2 ? `${names.slice(0, 2).join(', ')} ${t('filter.plusMore', { count: names.length - 2 })}` : names.join(', ');
    return `${v.exclude ? t('filter.notPrefix') : ''}${text}`;
  }
  const fmt = (x: string) => formatDateValue(x, f.format, dateLocale);
  if (v.from && v.to) return `${fmt(v.from)} – ${fmt(v.to)}`;
  return v.from ? `≥ ${fmt(v.from)}` : `≤ ${fmt(v.to!)}`;
}

const chips = computed(() =>
  props.table.filters.value
    .map((f) => ({ f, v: props.table.state.filters[f.id] }))
    .filter((x): x is { f: FilterSchema; v: FilterValue } => !isEmptyFilterValue(x.v))
    .map(({ f, v }) => ({ id: f.id, label: f.label, text: describe(f, v) })),
);
</script>

<template>
  <div v-if="chips.length" class="flex flex-wrap items-center gap-1.5">
    <span v-for="c in chips" :key="c.id" class="badge badge-soft badge-primary gap-1 pr-1 text-xs">
      <span class="opacity-70">{{ c.label }}:</span>
      <span class="max-w-48 truncate font-medium">{{ c.text }}</span>
      <button type="button" class="btn btn-ghost btn-xs btn-circle size-4 min-h-0" :aria-label="`${t('action.clear')} ${c.label}`" @click="table.setFilter(c.id, undefined)">
        <MrcIcon name="x" :size="10" />
      </button>
    </span>
    <button v-if="chips.length > 1" type="button" class="btn btn-ghost btn-xs" @click="table.clearFilters()">{{ t('action.clear') }}</button>
  </div>
</template>
