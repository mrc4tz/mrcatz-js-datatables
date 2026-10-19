<script setup lang="ts">
/** Panel filter yang dibuka dari tombol filter di toolbar (pengganti `#dtFilter`). */
import { computed } from 'vue';
import type { DataTableController } from '../../composables/useDataTable';
import FilterField from './FilterField.vue';

const props = defineProps<{ table: DataTableController<any> }>();
const visibleFilters = computed(() => props.table.filters.value.filter((f) => f.visible));
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
        @change="table.setFilter(f.id, $event)"
      />
    </div>
  </div>
</template>
