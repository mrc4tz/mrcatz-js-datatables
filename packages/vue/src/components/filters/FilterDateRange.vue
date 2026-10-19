<script setup lang="ts">
/** Filter rentang tanggal (pengganti `createDateRange`) — popover shortcut + dua input. */
import { computed, ref, watch } from 'vue';
import type { FilterSchema, RangeValue } from '@mrcatz/datatable-core';
import { useMrcatz } from '../../config';
import MrcPopover from '../MrcPopover.vue';
import FilterTrigger from './FilterTrigger.vue';
import { inputStep, inputType, presetRangeFor, presetsFor, type RangePreset } from './dateUtils';

const props = defineProps<{ filter: FilterSchema; value?: RangeValue }>();
const emit = defineEmits<{ change: [value: RangeValue | undefined] }>();
const { t } = useMrcatz();

const open = ref(false);
const from = ref('');
const to = ref('');
const activePreset = ref<RangePreset | null>(null);
watch(open, (v) => {
  if (!v) return;
  from.value = props.value?.from ?? '';
  to.value = props.value?.to ?? '';
  activePreset.value = null;
});

const type = computed(() => inputType(props.filter.format));
const presets = computed(() => presetsFor(props.filter.format));
const hasValue = computed(() => !!(props.value?.from || props.value?.to));
const text = computed(() =>
  hasValue.value
    ? `${t('filter.from')} ${props.value?.from || '…'}  →  ${t('filter.to')} ${props.value?.to || '…'}`
    : t('filter.pickRange'),
);

function usePreset(p: RangePreset) {
  const r = presetRangeFor(p, props.filter.format);
  from.value = r.from ?? '';
  to.value = r.to ?? '';
  activePreset.value = p;
}
function apply() {
  let f = from.value || null;
  let tt = to.value || null;
  if (f && tt && f > tt) [f, tt] = [tt, f];
  emit('change', f || tt ? { from: f, to: tt } : undefined);
  open.value = false;
}
function clear() {
  emit('change', undefined);
  open.value = false;
}
</script>

<template>
  <MrcPopover v-model:open="open" width="22rem" class="w-full" panel-class="bg-base-100 border-base-300 overflow-hidden rounded-xl border shadow-2xl">
    <template #trigger>
      <FilterTrigger icon="event" :text="text" :active="open" :has-value="hasValue" :clear-label="t('filter.clear')" @toggle="open = !open" @clear="clear" />
    </template>

    <div class="grid" :class="presets.length ? 'grid-cols-[7.5rem_1fr]' : 'grid-cols-1'">
      <div v-if="presets.length" class="bg-base-200/50 border-base-300 max-h-[20rem] overflow-y-auto border-r py-2">
        <button
          v-for="p in presets"
          :key="p"
          type="button"
          class="hover:bg-base-300/50 block w-full px-3 py-1.5 text-left text-xs transition-colors"
          :class="activePreset === p ? 'bg-primary/10 text-primary font-semibold' : 'text-base-content/70'"
          @click="usePreset(p)"
        >
          {{ t(`filter.${p}`) }}
        </button>
      </div>
      <div class="space-y-3 p-3">
        <div>
          <label class="text-base-content/60 mb-1 block text-xs font-medium">{{ t('filter.from') }}</label>
          <input v-model="from" :type="type" :step="inputStep(filter.format)" class="input input-bordered input-sm w-full text-sm" :min="filter.min" :max="to || filter.max" @change="activePreset = null" />
        </div>
        <div>
          <label class="text-base-content/60 mb-1 block text-xs font-medium">{{ t('filter.to') }}</label>
          <input v-model="to" :type="type" :step="inputStep(filter.format)" class="input input-bordered input-sm w-full text-sm" :min="from || filter.min" :max="filter.max" @change="activePreset = null" />
        </div>
        <div class="flex gap-2 pt-1">
          <button type="button" class="btn btn-ghost btn-sm flex-1" @click="clear">{{ t('filter.clear') }}</button>
          <button type="button" class="btn btn-primary btn-sm flex-1" @click="apply">{{ t('filter.apply') }}</button>
        </div>
      </div>
    </div>
  </MrcPopover>
</template>
