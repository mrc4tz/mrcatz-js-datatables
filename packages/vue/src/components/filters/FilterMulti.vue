<script setup lang="ts">
/**
 * Filter multi-pilihan (pengganti `createCheck`). Pilihan disusun dulu di
 * draf lalu diterapkan dengan tombol Terapkan — tabel tidak di-query ulang
 * pada setiap centang.
 */
import { computed, ref, watch } from 'vue';
import type { FilterSchema, MultiValue } from '@mrcatz/datatable-core';
import { useMrcatz } from '../../config';
import MrcPopover from '../MrcPopover.vue';
import MrcIcon from '../MrcIcon.vue';

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

const summary = computed(() => {
  const vals = props.value?.values ?? [];
  if (!vals.length) return t('filter.all');
  const labels = vals.map((v) => options.value.find((o) => String(o.value) === String(v))?.label ?? String(v));
  const head = labels.slice(0, 2).join(', ');
  const more = labels.length > 2 ? ` ${t('filter.plusMore', { count: labels.length - 2 })}` : '';
  return `${props.value?.exclude ? t('filter.notPrefix') : ''}${head}${more}`;
});

function toggle(v: string) {
  draft.value = draft.value.includes(v) ? draft.value.filter((x) => x !== v) : [...draft.value, v];
}
function selectAllVisible() {
  draft.value = [...new Set([...draft.value, ...visible.value.map((o) => String(o.value))])];
}
function apply(close: () => void) {
  emit('change', draft.value.length ? { values: draft.value, exclude: exclude.value } : undefined);
  close();
}
</script>

<template>
  <MrcPopover v-model:open="open" width="17rem" class="w-full">
    <template #trigger="{ toggle: toggleOpen }">
      <button
        type="button"
        class="select select-sm w-full text-left"
        :class="{ 'text-base-content/50': !value?.values.length, 'select-primary': value?.values.length }"
        @click="toggleOpen"
      >
        <span class="truncate">{{ summary }}</span>
      </button>
    </template>

    <template #default="{ close }">
      <div class="flex flex-col gap-2">
        <div v-if="filter.allowExclude" class="join w-full">
          <button type="button" class="btn btn-xs join-item flex-1" :class="!exclude ? 'btn-primary' : 'btn-ghost'" @click="exclude = false">
            {{ t('filter.include') }}
          </button>
          <button type="button" class="btn btn-xs join-item flex-1" :class="exclude ? 'btn-error' : 'btn-ghost'" @click="exclude = true">
            {{ t('filter.exclude') }}
          </button>
        </div>

        <label v-if="showSearch" class="input input-sm w-full">
          <MrcIcon name="search" :size="14" class="opacity-50" />
          <input v-model="query" type="search" :placeholder="t('filter.searchOption')" />
        </label>

        <div class="text-base-content/60 flex items-center justify-between text-xs">
          <span>{{ t('filter.selected', { count: draft.length, total: options.length }) }}</span>
          <span class="flex gap-2">
            <button type="button" class="link link-hover" @click="selectAllVisible">{{ t('filter.selectAll') }}</button>
            <button type="button" class="link link-hover" @click="draft = []">{{ t('filter.clearSelection') }}</button>
          </span>
        </div>

        <ul class="max-h-56 overflow-y-auto">
          <li v-for="o in visible" :key="String(o.value)">
            <label class="hover:bg-base-200 flex cursor-pointer items-center gap-2 rounded-field px-2 py-1.5 text-sm">
              <input
                type="checkbox"
                class="checkbox checkbox-xs"
                :class="exclude ? 'checkbox-error' : 'checkbox-primary'"
                :checked="draft.includes(String(o.value))"
                @change="toggle(String(o.value))"
              />
              <span class="truncate" :class="{ 'line-through opacity-70': exclude && draft.includes(String(o.value)) }">{{ o.label }}</span>
            </label>
          </li>
          <li v-if="!visible.length" class="text-base-content/50 px-2 py-2 text-xs">{{ t('filter.noMatch', { query }) }}</li>
        </ul>

        <div class="flex justify-end gap-2 pt-1">
          <button type="button" class="btn btn-ghost btn-xs" @click="emit('change', undefined); close()">{{ t('action.reset') }}</button>
          <button type="button" class="btn btn-primary btn-xs" @click="apply(close)">{{ t('action.apply') }}</button>
        </div>
      </div>
    </template>
  </MrcPopover>
</template>
