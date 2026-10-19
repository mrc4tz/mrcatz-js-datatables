<script setup lang="ts">
/**
 * Pilihan tunggal dengan pencarian label — dipakai filter select dan field
 * `select` di form. Nilai = id/kode, label = nama. Navigasi keyboard:
 * ↑/↓ pilih, Enter terapkan, Escape tutup.
 */
import { computed, nextTick, ref, watch } from 'vue';
import { useMrcatz } from '../config';
import type { FieldOption } from '../fields';
import MrcPopover from './MrcPopover.vue';
import MrcIcon from './MrcIcon.vue';

type Value = FieldOption['value'];
type Option = FieldOption;

const props = withDefaults(
  defineProps<{
    options: Option[];
    placeholder?: string;
    /** Tampilkan opsi "Semua" untuk mengosongkan (filter). */
    clearable?: boolean;
    clearLabel?: string;
    disabled?: boolean;
    loading?: boolean;
    error?: boolean;
    size?: 'xs' | 'sm' | 'md';
    /** Kotak cari muncul bila opsi lebih dari angka ini. */
    searchThreshold?: number;
    id?: string;
  }>(),
  { clearable: false, size: 'sm', searchThreshold: 6 },
);
const model = defineModel<Value | null | undefined>();
const { t } = useMrcatz();

const open = ref(false);
const query = ref('');
const active = ref(0);
const input = ref<HTMLInputElement>();

const selected = computed(() => props.options.find((o) => String(o.value) === String(model.value)));
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return q ? props.options.filter((o) => o.label.toLowerCase().includes(q)) : props.options;
});

watch(open, async (v) => {
  if (!v) return;
  query.value = '';
  active.value = Math.max(0, filtered.value.findIndex((o) => o === selected.value));
  await nextTick();
  input.value?.focus();
});

function choose(o: Option | null) {
  model.value = o ? o.value : null;
  open.value = false;
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    active.value = Math.min(active.value + 1, filtered.value.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    active.value = Math.max(active.value - 1, 0);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const o = filtered.value[active.value];
    if (o) choose(o);
  }
}
const sizes = { xs: 'select-xs', sm: 'select-sm', md: '' };
</script>

<template>
  <MrcPopover v-model:open="open" width="trigger" :disabled="disabled" class="w-full">
    <template #trigger="{ toggle }">
      <button
        :id="id"
        type="button"
        class="select w-full text-left"
        :class="[sizes[size], { 'select-error': error, 'text-base-content/50': !selected }]"
        :disabled="disabled"
        :aria-expanded="open"
        aria-haspopup="listbox"
        @click="toggle"
        @keydown.down.prevent="open = true"
      >
        <span class="truncate">{{ selected?.label ?? placeholder ?? t('form.choose') }}</span>
        <span v-if="loading" class="loading loading-spinner loading-xs ml-auto" />
      </button>
    </template>

    <div class="flex flex-col gap-1" @keydown="onKey">
      <label v-if="options.length > searchThreshold" class="input input-sm mb-1 w-full">
        <MrcIcon name="search" :size="14" class="opacity-50" />
        <input ref="input" v-model="query" type="search" :placeholder="t('filter.searchOption')" @input="active = 0" />
      </label>
      <ul class="menu menu-sm max-h-64 w-full flex-nowrap overflow-y-auto p-0" role="listbox">
        <li v-if="clearable">
          <button type="button" :class="{ 'menu-active': model === null || model === undefined || model === '' }" @click="choose(null)">
            {{ clearLabel ?? t('filter.all') }}
          </button>
        </li>
        <li v-for="(o, i) in filtered" :key="String(o.value)">
          <button
            type="button"
            role="option"
            :aria-selected="o === selected"
            :class="{ 'menu-active': o === selected, 'menu-focus bg-base-200': i === active && o !== selected }"
            @click="choose(o)"
            @mouseenter="active = i"
          >
            <span class="truncate">{{ o.label }}</span>
            <MrcIcon v-if="o === selected" name="check" :size="14" class="ml-auto" />
          </button>
        </li>
        <li v-if="!filtered.length" class="text-base-content/50 px-3 py-2 text-xs">
          {{ query ? t('filter.noMatch', { query }) : t('form.noOptions') }}
        </li>
      </ul>
    </div>
  </MrcPopover>
</template>
