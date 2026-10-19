<script setup lang="ts">
/** Satu kontrol filter sesuai tipenya. */
import { computed } from 'vue';
import type { FilterSchema, FilterValue, MultiValue, RangeValue } from '@mrcatz/datatable-core';
import MrcCombobox from '../MrcCombobox.vue';
import FilterMulti from './FilterMulti.vue';
import FilterDateRange from './FilterDateRange.vue';
import { inputType } from './dateUtils';

const props = defineProps<{ filter: FilterSchema; value?: FilterValue; loading?: boolean }>();
const emit = defineEmits<{ change: [value: FilterValue | undefined] }>();

const selectValue = computed({
  get: () => (typeof props.value === 'string' ? props.value : null),
  set: (v) => emit('change', v === null || v === undefined || v === '' ? undefined : String(v)),
});
</script>

<template>
  <MrcCombobox
    v-if="filter.type === 'select'"
    v-model="selectValue"
    :options="filter.options ?? []"
    clearable
    :loading="loading"
    :class="{ 'mrc-filter-active': selectValue !== null }"
  />
  <FilterMulti
    v-else-if="filter.type === 'multi'"
    :filter="filter"
    :value="value as MultiValue | undefined"
    @change="emit('change', $event)"
  />
  <FilterDateRange
    v-else-if="filter.type === 'dateRange'"
    :filter="filter"
    :value="value as RangeValue | undefined"
    @change="emit('change', $event)"
  />
  <input
    v-else
    :type="inputType(filter.format)"
    class="input input-sm w-full"
    :class="{ 'input-primary': value }"
    :value="typeof value === 'string' ? value : ''"
    :min="filter.format === 'year' ? (filter.min ?? 1900) : filter.min"
    :max="filter.format === 'year' ? (filter.max ?? 2100) : filter.max"
    @change="emit('change', ($event.target as HTMLInputElement).value || undefined)"
  />
</template>
