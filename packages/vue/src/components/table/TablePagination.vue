<script setup lang="ts">
/** Pagination bernomor dengan elipsis + pemilih jumlah baris. */
import { computed } from 'vue';
import { useMrcatz } from '../../config';
import type { DataTableController } from '../../composables/useDataTable';
import MrcIcon from '../MrcIcon.vue';

const props = defineProps<{ table: DataTableController<any> }>();
const { t } = useMrcatz();

const meta = computed(() => props.table.meta.value);
const from = computed(() => (meta.value.total === 0 ? 0 : (meta.value.page - 1) * meta.value.limit + 1));
const to = computed(() => Math.min(meta.value.page * meta.value.limit, meta.value.total));

/** 1 … 4 5 [6] 7 8 … 20 */
const pages = computed<Array<number | '…'>>(() => {
  const total = meta.value.totalPages;
  const cur = meta.value.page;
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, cur, cur - 1, cur + 1]);
  if (cur <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (cur >= total - 2) [total - 1, total - 2, total - 3].forEach((n) => set.add(n));
  const sorted = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  sorted.forEach((n, i) => {
    if (i && n - sorted[i - 1]! > 1) out.push('…');
    out.push(n);
  });
  return out;
});
</script>

<template>
  <div class="flex flex-col-reverse items-center justify-between gap-3 text-sm sm:flex-row">
    <div class="text-base-content/70 flex items-center gap-2">
      <span class="hidden sm:inline">{{ t('pagination.perPage') }}</span>
      <select
        class="select select-sm w-20"
        :value="table.state.limit"
        :aria-label="t('pagination.perPage')"
        @change="table.setLimit(Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="n in table.perPageOptions" :key="n" :value="n">{{ n }}</option>
      </select>
      <span class="tabular-nums">{{ t('pagination.range', { from, to, total: meta.total.toLocaleString() }) }}</span>
    </div>

    <nav class="join" :aria-label="t('pagination.page', { page: meta.page })">
      <button type="button" class="join-item btn btn-sm btn-ghost" :disabled="meta.page <= 1" :aria-label="t('pagination.prev')" @click="table.goToPage(meta.page - 1)">
        <MrcIcon name="chevron-left" />
      </button>
      <template v-for="(p, i) in pages" :key="i">
        <span v-if="p === '…'" class="join-item btn btn-sm btn-ghost btn-disabled hidden sm:inline-flex">…</span>
        <button
          v-else
          type="button"
          class="join-item btn btn-sm tabular-nums"
          :class="p === meta.page ? 'btn-primary' : 'btn-ghost hidden sm:inline-flex'"
          :aria-current="p === meta.page ? 'page' : undefined"
          @click="table.goToPage(p)"
        >
          {{ p }}
        </button>
      </template>
      <button
        type="button"
        class="join-item btn btn-sm btn-ghost"
        :disabled="meta.page >= meta.totalPages"
        :aria-label="t('pagination.next')"
        @click="table.goToPage(meta.page + 1)"
      >
        <MrcIcon name="chevron-right" />
      </button>
    </nav>
  </div>
</template>
