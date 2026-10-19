<script setup lang="ts">
/** Panel filter yang dibuka dari tombol filter di toolbar (pengganti `#dtFilter`). */
import { computed, onBeforeUnmount } from 'vue';
import type { FilterSchema, FilterValue } from '@mrc4tz/datatable-core';
import type { DataTableController } from '../../composables/useDataTable';
import FilterField from './FilterField.vue';

const props = defineProps<{
  table: DataTableController<any>;
  /** Jeda (ms) sebelum perubahan filter select/tanggal diterapkan (pengganti `$filterDebounceDelay`). */
  debounce?: number;
}>();
const visibleFilters = computed(() => props.table.filters.value.filter((f) => f.visible));

// Multi & rentang tanggal sudah punya tombol Terapkan → langsung; select/tanggal di-debounce.
const timers = new Map<string, ReturnType<typeof setTimeout>>();
function change(f: FilterSchema, value: FilterValue | undefined) {
  clearTimeout(timers.get(f.id));
  if (!props.debounce || f.type === 'multi' || f.type === 'dateRange') return props.table.setFilter(f.id, value);
  timers.set(
    f.id,
    setTimeout(() => {
      timers.delete(f.id);
      props.table.setFilter(f.id, value);
    }, props.debounce),
  );
}
onBeforeUnmount(() => timers.forEach((t) => clearTimeout(t)));
</script>

<template>
  <div class="bg-base-200/50 border-base-content/10 mb-4 rounded-xl border p-4">
    <div class="flex flex-wrap gap-4">
      <FilterField
        v-for="f in visibleFilters"
        :key="f.id"
        :filter="f"
        :value="table.state.filters[f.id]"
        :loading="table.filtersLoading.value"
        @change="change(f, $event)"
      />
    </div>
  </div>
</template>
