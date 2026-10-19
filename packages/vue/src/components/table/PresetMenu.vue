<script setup lang="ts">
/**
 * Isi menu Filter Preset (pengganti `partials/preset-content.blade.php`):
 * simpan kombinasi pencarian/filter/urutan ke localStorage, per halaman.
 */
import { computed, ref } from 'vue';
import type { FilterValue, SortRule } from '@mrc4tz/datatable-core';
import { useMrcatz } from '../../config';
import type { DataTableController } from '../../composables/useDataTable';
import MrcIcon from '../MrcIcon.vue';

const props = defineProps<{ table: DataTableController<any> }>();
const emit = defineEmits<{ applied: [] }>();
const { t } = useMrcatz();

interface Preset {
  name: string;
  search: string;
  sort: SortRule[];
  filters: Record<string, FilterValue>;
}
const key = computed(() => `mrcatz_presets_${typeof window !== 'undefined' ? window.location.pathname : ''}${props.table.name ? `_${props.table.name}` : ''}`);
function load(): Preset[] {
  try {
    return JSON.parse(localStorage.getItem(key.value) ?? '[]') as Preset[];
  } catch {
    return [];
  }
}
const presets = ref<Preset[]>(load());
const name = ref('');

function persist() {
  try {
    localStorage.setItem(key.value, JSON.stringify(presets.value));
  } catch {
    /* storage tidak tersedia — preset hanya bertahan di sesi ini */
  }
}
function save() {
  const n = name.value.trim();
  if (!n) return;
  const s = props.table.state;
  presets.value = [...presets.value, { name: n, search: s.search, sort: [...s.sort], filters: JSON.parse(JSON.stringify(s.filters)) }];
  name.value = '';
  persist();
}
function apply(p: Preset) {
  props.table.applyState(p);
  emit('applied');
}
function remove(i: number) {
  presets.value = presets.value.filter((_, idx) => idx !== i);
  persist();
}
</script>

<template>
  <div class="space-y-2">
    <p class="text-base-content/50 text-xs font-semibold tracking-wide uppercase">{{ t('filter.preset') }}</p>
    <p v-if="!presets.length" class="text-base-content/30 py-2 text-xs italic">{{ t('filter.noPreset') }}</p>
    <div
      v-for="(p, i) in presets"
      :key="i"
      class="group hover:bg-base-200/50 flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5"
    >
      <button type="button" class="text-base-content/70 flex-1 truncate text-left text-sm" @click="apply(p)">{{ p.name }}</button>
      <button type="button" class="text-base-content/20 group-hover:text-error text-xs transition-colors" @click.stop="remove(i)">
        <MrcIcon name="close" :size="14" />
      </button>
    </div>
    <div class="border-base-content/10 mt-2 border-t pt-2">
      <div class="flex gap-1">
        <input v-model="name" type="text" class="input input-bordered input-xs flex-1 text-xs" :placeholder="t('filter.presetPlaceholder')" @keydown.enter.prevent="save" />
        <button type="button" class="btn btn-xs btn-primary btn-square" @click="save"><MrcIcon name="save" :size="14" /></button>
      </div>
    </div>
  </div>
</template>
