<script setup lang="ts">
/**
 * Field rentang tanggal — port `partials/form/date-range.blade.php`:
 * tombol bergaya `input` + popover berisi shortcut dan dua input Dari/Sampai.
 * Nilai satu objek `{ from, to }`.
 */
import { computed, ref, watch } from 'vue';
import { useMrcatz } from '../../../config';
import type { DateRangeValue, FieldDef } from '../../../fields';
import MrcIcon from '../../MrcIcon.vue';
import MrcPopover from '../../MrcPopover.vue';
import { presetRange, RANGE_PRESETS, type RangePreset } from '../../filters/dateUtils';

const props = defineProps<{ field: FieldDef; modelValue?: DateRangeValue | null; disabled?: boolean; invalid?: boolean; inputClass?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: DateRangeValue] }>();
const { t } = useMrcatz();

const open = ref(false);
const from = ref('');
const to = ref('');
const activePreset = ref<RangePreset | null>(null);
watch(open, (v) => {
  if (!v) return;
  from.value = props.modelValue?.from ?? '';
  to.value = props.modelValue?.to ?? '';
});

const TYPES: Record<string, string> = { date: 'date', datetime: 'datetime-local', month: 'month', year: 'number' };
const type = computed(() => TYPES[props.field.format ?? 'date'] ?? 'date');
const showPresets = computed(() => props.field.presets ?? (props.field.format ?? 'date') === 'date');
const min = computed(() => (props.field.min !== undefined ? String(props.field.min) : undefined));
const max = computed(() => (props.field.max !== undefined ? String(props.field.max) : undefined));
const hasValue = computed(() => !!(props.modelValue?.from || props.modelValue?.to));
const text = computed(() =>
  hasValue.value
    ? `${t('filter.from')} ${props.modelValue?.from || '…'}  →  ${t('filter.to')} ${props.modelValue?.to || '…'}`
    : (props.field.placeholder ?? t('filter.pickRange')),
);

function usePreset(p: RangePreset) {
  const r = presetRange(p);
  from.value = r.from ?? '';
  to.value = r.to ?? '';
  activePreset.value = p;
}
function apply() {
  let f = from.value || null;
  let tt = to.value || null;
  // Tukar otomatis bila terbalik, sama dengan versi Laravel.
  if (f && tt && f > tt) [f, tt] = [tt, f];
  emit('update:modelValue', { from: f, to: tt });
  open.value = false;
}
function clear() {
  from.value = '';
  to.value = '';
  activePreset.value = null;
  emit('update:modelValue', { from: null, to: null });
  open.value = false;
}
</script>

<template>
  <MrcPopover v-model:open="open" width="22rem" class="w-full" :disabled="disabled" panel-class="bg-base-100 border-base-300 overflow-hidden rounded-xl border shadow-2xl">
    <template #trigger="{ toggle }">
      <button
        type="button"
        class="input input-bordered flex w-full items-center gap-3 text-left transition-all duration-200 focus-within:shadow-sm"
        :class="[inputClass, { 'input-error': invalid, 'bg-base-200 opacity-60': disabled, 'input-primary': open }]"
        :disabled="disabled"
        @click="toggle"
      >
        <span v-if="field.icon" class="text-base-content/40 inline-flex shrink-0 items-center justify-center self-center"><MrcIcon :name="field.icon" /></span>
        <span class="min-w-0 grow truncate text-sm" :class="hasValue ? 'text-base-content' : 'text-base-content/40'">{{ text }}</span>
        <span class="flex shrink-0 items-center gap-1">
          <span
            v-if="hasValue && !disabled"
            role="button"
            tabindex="0"
            class="hover:bg-base-200 text-base-content/40 hover:text-base-content/70 inline-flex cursor-pointer items-center justify-center rounded-full p-0.5 transition"
            :title="t('filter.clear')"
            @click.stop="clear"
            @keydown.enter.stop.prevent="clear"
            @keydown.space.stop.prevent="clear"
          >
            <MrcIcon name="close" :size="16" />
          </span>
          <MrcIcon name="expand_more" :size="20" class="text-base-content/40" />
        </span>
      </button>
    </template>

    <div :class="showPresets ? 'grid grid-cols-[7.5rem_1fr]' : ''">
      <div v-if="showPresets" class="bg-base-200/50 border-base-300 max-h-[20rem] overflow-y-auto border-r py-2">
        <button
          v-for="p in RANGE_PRESETS"
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
          <input v-model="from" :type="type" class="input input-bordered input-sm w-full text-sm" :min="min" :max="to || max" data-part="from" @change="activePreset = null" />
        </div>
        <div>
          <label class="text-base-content/60 mb-1 block text-xs font-medium">{{ t('filter.to') }}</label>
          <input v-model="to" :type="type" class="input input-bordered input-sm w-full text-sm" :min="from || min" :max="max" data-part="to" @change="activePreset = null" />
        </div>
        <div class="flex gap-2 pt-1">
          <button type="button" class="btn btn-ghost btn-sm flex-1" @click="clear">{{ t('filter.clear') }}</button>
          <button type="button" class="btn btn-primary btn-sm flex-1" data-part="apply" @click="apply">{{ t('filter.apply') }}</button>
        </div>
      </div>
    </div>
  </MrcPopover>
</template>
