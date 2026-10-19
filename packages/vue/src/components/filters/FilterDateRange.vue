<script setup lang="ts">
/** Filter rentang tanggal (pengganti `createDateRange`) — rentang terbuka didukung. */
import { computed, ref, watch } from 'vue';
import type { FilterSchema, RangeValue } from '@mrcatz/datatable-core';
import { useMrcatz } from '../../config';
import MrcPopover from '../MrcPopover.vue';
import MrcIcon from '../MrcIcon.vue';
import { formatDateValue, inputType, presetRange, type RangePreset } from './dateUtils';

const props = defineProps<{ filter: FilterSchema; value?: RangeValue }>();
const emit = defineEmits<{ change: [value: RangeValue | undefined] }>();
const { t, dateLocale } = useMrcatz();

const open = ref(false);
const from = ref('');
const to = ref('');
watch(open, (v) => {
  if (!v) return;
  from.value = props.value?.from ?? '';
  to.value = props.value?.to ?? '';
});

const type = computed(() => inputType(props.filter.format));
const presets: RangePreset[] = ['today', 'yesterday', 'last7', 'last30', 'thisMonth', 'thisYear'];

const summary = computed(() => {
  const f = props.value?.from;
  const tt = props.value?.to;
  if (!f && !tt) return t('filter.pickRange');
  const fmt = (v: string) => formatDateValue(v, props.filter.format, dateLocale);
  if (f && tt) return f === tt ? fmt(f) : `${fmt(f)} – ${fmt(tt)}`;
  return f ? `≥ ${fmt(f)}` : `≤ ${fmt(tt!)}`;
});

function apply(close: () => void, range?: RangeValue) {
  let f = range?.from ?? (from.value || null);
  let tt = range?.to ?? (to.value || null);
  if (f && tt && f > tt) [f, tt] = [tt, f];
  emit('change', f || tt ? { from: f, to: tt } : undefined);
  close();
}
</script>

<template>
  <MrcPopover v-model:open="open" width="19rem" class="w-full">
    <template #trigger="{ toggle }">
      <button
        type="button"
        class="select select-sm w-full text-left"
        :class="{ 'text-base-content/50': !value?.from && !value?.to, 'select-primary': value?.from || value?.to }"
        @click="toggle"
      >
        <MrcIcon name="calendar" :size="14" class="opacity-60" />
        <span class="truncate">{{ summary }}</span>
      </button>
    </template>

    <template #default="{ close }">
      <div class="flex flex-col gap-2">
        <div v-if="!filter.format || filter.format === 'date'" class="grid grid-cols-2 gap-1">
          <button v-for="p in presets" :key="p" type="button" class="btn btn-ghost btn-xs justify-start" @click="apply(close, presetRange(p))">
            {{ t(`filter.${p}`) }}
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <label class="flex flex-col gap-1 text-xs">
            {{ t('filter.from') }}
            <input v-model="from" :type="type" class="input input-sm w-full" :min="filter.min" :max="to || filter.max" />
          </label>
          <label class="flex flex-col gap-1 text-xs">
            {{ t('filter.to') }}
            <input v-model="to" :type="type" class="input input-sm w-full" :min="from || filter.min" :max="filter.max" />
          </label>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <button type="button" class="btn btn-ghost btn-xs" @click="emit('change', undefined); close()">{{ t('action.clear') }}</button>
          <button type="button" class="btn btn-primary btn-xs" @click="apply(close)">{{ t('action.apply') }}</button>
        </div>
      </div>
    </template>
  </MrcPopover>
</template>
