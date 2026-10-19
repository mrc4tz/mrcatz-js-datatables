<script setup lang="ts">
/**
 * Filter multi-pilihan (pengganti `createCheck`). Pilihan disusun di draf lalu
 * diterapkan dengan Terapkan — tabel tidak di-query ulang tiap centang.
 */
import { computed, ref, watch } from 'vue';
import { highlight, type FilterSchema, type MultiValue } from '@mrc4tz/datatable-core';
import { useMrcatz } from '../../config';
import MrcPopover from '../MrcPopover.vue';
import FilterTrigger from './FilterTrigger.vue';

const props = defineProps<{ filter: FilterSchema; value?: MultiValue }>();
const emit = defineEmits<{ change: [value: MultiValue | undefined] }>();
const { t } = useMrcatz();

const open = ref(false);
const draft = ref<string[]>([]);
const exclude = ref(false);
const query = ref('');

const options = computed(() => props.filter.options ?? []);
const showSearch = computed(
  () => props.filter.searchThreshold !== null && options.value.length > (props.filter.searchThreshold ?? 5),
);
const visible = computed(() => {
  const q = query.value.trim().toLowerCase();
  return q ? options.value.filter((o) => o.label.toLowerCase().includes(q)) : options.value;
});

watch(open, (v) => {
  if (!v) return;
  draft.value = [...(props.value?.values ?? [])].map(String);
  exclude.value = !!props.value?.exclude;
  query.value = '';
});

const hasValue = computed(() => !!props.value?.values.length);
const text = computed(() => {
  const vals = props.value?.values ?? [];
  if (!vals.length) return t('filter.pickOptions');
  const names = vals.map((v) => options.value.find((o) => String(o.value) === String(v))?.label ?? String(v));
  const txt = names.length <= 2 ? names.join(', ') : `${names[0]} ${t('filter.plusMore', { count: names.length - 1 })}`;
  return props.value?.exclude ? t('filter.notPrefix') + txt : txt;
});

function toggle(v: string) {
  draft.value = draft.value.includes(v) ? draft.value.filter((x) => x !== v) : [...draft.value, v];
}
function selectAllVisible() {
  draft.value = [...new Set([...draft.value, ...visible.value.map((o) => String(o.value))])];
}
function clearVisible() {
  const vis = new Set(visible.value.map((o) => String(o.value)));
  draft.value = draft.value.filter((v) => !vis.has(v));
}
function apply() {
  emit('change', draft.value.length ? { values: draft.value, exclude: exclude.value } : undefined);
  open.value = false;
}
function reset() {
  emit('change', undefined);
  open.value = false;
}
</script>

<template>
  <MrcPopover v-model:open="open" width="20rem" class="w-full" panel-class="bg-base-100 border-base-300 overflow-hidden rounded-xl border shadow-2xl">
    <template #trigger>
      <FilterTrigger icon="checklist" :text="text" :active="open" :has-value="hasValue" :clear-label="t('filter.clear')" @toggle="open = !open" @clear="reset" />
    </template>

    <div class="flex flex-col">
      <div v-if="filter.allowExclude" class="border-base-300 bg-base-200/50 flex items-stretch gap-1 border-b p-2">
        <button
          type="button"
          class="flex-1 rounded px-2 py-1 text-xs transition-colors"
          :class="!exclude ? 'bg-primary text-primary-content font-semibold' : 'text-base-content/60 hover:bg-base-300/50'"
          @click="exclude = false"
        >
          {{ t('filter.include') }}
        </button>
        <button
          type="button"
          class="flex-1 rounded px-2 py-1 text-xs transition-colors"
          :class="exclude ? 'bg-error text-error-content font-semibold' : 'text-base-content/60 hover:bg-base-300/50'"
          @click="exclude = true"
        >
          {{ t('filter.exclude') }}
        </button>
      </div>

      <div v-if="showSearch" class="border-base-300 border-b p-2">
        <input v-model="query" type="text" class="input input-bordered input-sm w-full text-sm" :placeholder="t('filter.searchOption')" />
      </div>

      <div class="max-h-[16rem] overflow-y-auto">
        <label v-for="o in visible" :key="String(o.value)" class="hover:bg-base-200 flex cursor-pointer items-start gap-2 px-3 py-2 text-sm">
          <input
            type="checkbox"
            class="checkbox checkbox-sm checkbox-primary shrink-0"
            :checked="draft.includes(String(o.value))"
            @change="toggle(String(o.value))"
          />
          <span class="min-w-0 flex-1 leading-5 break-words">
            <template v-for="(s, i) in highlight(o.label, query)" :key="i">
              <mark v-if="s.match" class="bg-warning/40 text-base-content rounded px-0.5">{{ s.text }}</mark>
              <template v-else>{{ s.text }}</template>
            </template>
          </span>
        </label>
        <div v-if="!visible.length" class="text-base-content/50 px-3 py-6 text-center text-sm">{{ t('filter.noMatch', { query }) }}</div>
      </div>

      <div class="border-base-300 bg-base-200/30 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t px-3 py-2 text-xs">
        <span class="text-base-content/60 whitespace-nowrap">{{ t('filter.selected', { count: draft.length, total: options.length }) }}</span>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="text-primary whitespace-nowrap hover:underline" @click="selectAllVisible">{{ t('filter.selectAll') }}</button>
          <span class="text-base-content/30">·</span>
          <button type="button" class="text-primary whitespace-nowrap hover:underline" @click="clearVisible">{{ t('filter.clearSelection') }}</button>
        </div>
      </div>

      <div class="border-base-300 flex gap-2 border-t p-2">
        <button type="button" class="btn btn-ghost btn-sm flex-1" @click="reset">{{ t('filter.resetFilter') }}</button>
        <button type="button" class="btn btn-primary btn-sm flex-1" @click="apply">{{ t('filter.apply') }}</button>
      </div>
    </div>
  </MrcPopover>
</template>
