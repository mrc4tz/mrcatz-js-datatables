<script setup lang="ts">
/** Satu kontrol filter sesuai tipenya (markup sama dengan `datatable-filter.blade.php`). */
import type { FilterSchema, FilterValue, MultiValue, RangeValue } from '@mrc4tz/datatable-core';
import { useMrcatz } from '../../config';
import FilterMulti from './FilterMulti.vue';
import FilterDateRange from './FilterDateRange.vue';
import { inputStep, inputType } from './dateUtils';

defineProps<{ filter: FilterSchema; value?: FilterValue; loading?: boolean }>();
const emit = defineEmits<{ change: [value: FilterValue | undefined] }>();
const { t } = useMrcatz();

function onSelect(e: Event) {
  const v = (e.target as HTMLSelectElement).value;
  emit('change', v === '' ? undefined : v);
}
</script>

<template>
  <div class="w-full sm:w-auto" :class="filter.type === 'multi' || filter.type === 'dateRange' ? 'sm:min-w-64' : 'sm:min-w-48'">
    <label class="text-base-content/50 mb-1 block text-xs font-semibold tracking-wide uppercase">{{ filter.label }}</label>

    <FilterMulti v-if="filter.type === 'multi'" :filter="filter" :value="value as MultiValue | undefined" @change="emit('change', $event)" />
    <FilterDateRange v-else-if="filter.type === 'dateRange'" :filter="filter" :value="value as RangeValue | undefined" @change="emit('change', $event)" />
    <input
      v-else-if="filter.type === 'date'"
      :type="inputType(filter.format)"
      :step="inputStep(filter.format)"
      class="input input-bordered input-sm focus:input-primary h-8 w-full text-sm transition-all duration-200"
      :value="typeof value === 'string' ? value : ''"
      :min="filter.format === 'year' ? (filter.min ?? 1900) : filter.min"
      :max="filter.format === 'year' ? (filter.max ?? 2100) : filter.max"
      @change="emit('change', ($event.target as HTMLInputElement).value || undefined)"
    />
    <select
      v-else
      class="select select-bordered select-sm focus:select-primary w-full text-sm transition-all duration-200"
      :disabled="loading && !filter.options?.length"
      @change="onSelect"
    >
      <option value="" :selected="value === undefined || value === ''">{{ t('filter.all') }}</option>
      <option v-for="o in filter.options ?? []" :key="String(o.value)" :value="String(o.value)" :selected="typeof value === 'string' && value === String(o.value)">
        {{ o.label }}
      </option>
    </select>
  </div>
</template>
