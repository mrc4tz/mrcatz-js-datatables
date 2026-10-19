<script setup lang="ts">
/**
 * Panel filter: kontrol tiap filter yang terlihat + preset tersimpan
 * (localStorage, per tabel). Dibuka dari tombol Filter di toolbar.
 */
import { computed, ref } from 'vue';
import type { FilterValue, SortRule } from '@mrcatz/datatable-core';
import { useMrcatz } from '../../config';
import type { DataTableController } from '../../composables/useDataTable';
import FilterField from './FilterField.vue';
import MrcIcon from '../MrcIcon.vue';

const props = defineProps<{ table: DataTableController<any>; presets?: boolean }>();
const { t } = useMrcatz();

const visibleFilters = computed(() => props.table.filters.value.filter((f) => f.visible));

// ---------------------------------------------------------------- presets
interface Preset {
  name: string;
  search: string;
  sort: SortRule[];
  filters: Record<string, FilterValue>;
}
const storageKey = computed(() => {
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  return `mrcatz:presets:${path}:${props.table.name}`;
});
function load(): Preset[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey.value) ?? '[]') as Preset[];
  } catch {
    return [];
  }
}
const list = ref<Preset[]>(props.presets ? load() : []);
const presetName = ref('');

function persist() {
  try {
    localStorage.setItem(storageKey.value, JSON.stringify(list.value));
  } catch {
    /* mode privat / storage penuh — preset hanya bertahan di sesi ini */
  }
}
function savePreset() {
  const name = presetName.value.trim();
  if (!name) return;
  const s = props.table.state;
  const item: Preset = { name, search: s.search, sort: [...s.sort], filters: JSON.parse(JSON.stringify(s.filters)) };
  list.value = [...list.value.filter((p) => p.name !== name), item];
  presetName.value = '';
  persist();
}
function removePreset(name: string) {
  list.value = list.value.filter((p) => p.name !== name);
  persist();
}
</script>

<template>
  <div class="bg-base-200/40 border-base-content/10 rounded-box border p-3">
    <p v-if="!visibleFilters.length && !presets" class="text-base-content/60 text-sm">{{ t('filter.none') }}</p>

    <div v-if="visibleFilters.length" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div v-for="f in visibleFilters" :key="f.id" class="flex min-w-0 flex-col gap-1">
        <span class="text-base-content/70 text-xs font-medium">{{ f.label }}</span>
        <FilterField
          :filter="f"
          :value="table.state.filters[f.id]"
          :loading="table.filtersLoading.value"
          @change="table.setFilter(f.id, $event)"
        />
      </div>
    </div>

    <div v-if="presets" class="border-base-content/10 mt-3 flex flex-col gap-2 border-t pt-3">
      <span class="text-base-content/70 flex items-center gap-1.5 text-xs font-medium">
        <MrcIcon name="bookmark" :size="13" /> {{ t('filter.presets') }}
      </span>
      <div class="flex flex-wrap items-center gap-2">
        <span v-if="!list.length" class="text-base-content/50 text-xs">{{ t('filter.noPresets') }}</span>
        <span v-for="p in list" :key="p.name" class="badge badge-outline gap-1 pr-1">
          <button type="button" class="hover:underline" @click="table.applyState(p)">{{ p.name }}</button>
          <button type="button" class="btn btn-ghost btn-xs btn-circle size-4 min-h-0" :aria-label="t('action.delete')" @click="removePreset(p.name)">
            <MrcIcon name="x" :size="10" />
          </button>
        </span>
        <form class="join ml-auto" @submit.prevent="savePreset">
          <input v-model="presetName" class="input input-xs join-item w-36" :placeholder="t('filter.presetName')" maxlength="40" />
          <button type="submit" class="btn btn-xs join-item" :disabled="!presetName.trim()">{{ t('filter.savePreset') }}</button>
        </form>
      </div>
    </div>
  </div>
</template>
