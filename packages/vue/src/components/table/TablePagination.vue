<script setup lang="ts">
/** Pagination (pengganti `components/ui/pagination.blade.php`). */
import { computed } from 'vue';
import { useMrcatz } from '../../config';
import type { DataTableController } from '../../composables/useDataTable';
import { pageWindow } from '../../pagination';
import MrcIcon from '../MrcIcon.vue';

const props = defineProps<{ table: DataTableController<any> }>();
const { t } = useMrcatz();

const meta = computed(() => props.table.meta.value);
const count = computed(() => props.table.rows.value.length);
const from = computed(() => (meta.value.page - 1) * meta.value.limit + 1);
const to = computed(() => from.value + count.value - 1);
const pages = computed(() => pageWindow(meta.value.page, meta.value.totalPages));
const first = computed(() => meta.value.page <= 1);
const last = computed(() => meta.value.page >= meta.value.totalPages);
</script>

<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div class="flex items-center gap-3">
      <span class="text-base-content/50 text-xs">{{ t('pagination.perPage') }}</span>
      <select
        class="select select-bordered select-xs focus:select-primary transition-all duration-200"
        :value="table.state.limit"
        @change="table.setLimit(Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="n in table.perPageOptions" :key="n" :value="n">{{ n }}</option>
      </select>
    </div>

    <div v-if="meta.totalPages > 1" class="flex flex-col items-center gap-3 sm:flex-row">
      <span class="text-base-content/50 text-xs">{{ from }} &ndash; {{ to }} {{ t('pagination.of') }} {{ meta.total }}</span>

      <!-- Mobile: sebelumnya, halaman/total, berikutnya -->
      <div class="join sm:hidden">
        <button class="join-item btn btn-sm" :class="first ? 'btn-disabled' : 'hover:btn-primary transition-colors duration-200'" :disabled="first" @click="table.goToPage(meta.page - 1)">
          <MrcIcon name="chevron_left" />
        </button>
        <button class="join-item btn btn-sm btn-primary text-xs font-bold">{{ meta.page }} / {{ meta.totalPages }}</button>
        <button class="join-item btn btn-sm" :class="last ? 'btn-disabled' : 'hover:btn-primary transition-colors duration-200'" :disabled="last" @click="table.goToPage(meta.page + 1)">
          <MrcIcon name="chevron_right" />
        </button>
      </div>

      <!-- Desktop: nomor halaman lengkap -->
      <div class="join hidden sm:flex">
        <button class="join-item btn btn-sm" :class="first ? 'btn-disabled' : 'hover:btn-primary transition-colors duration-200'" :disabled="first" @click="table.goToPage(meta.page - 1)">
          <MrcIcon name="chevron_left" />
        </button>
        <template v-for="(p, i) in pages" :key="i">
          <button v-if="p === '...'" class="join-item btn btn-sm btn-disabled text-xs" disabled>...</button>
          <button v-else-if="p === meta.page" class="join-item btn btn-sm btn-primary text-xs font-bold">{{ p }}</button>
          <button v-else class="join-item btn btn-sm hover:btn-primary text-xs transition-colors duration-200" @click="table.goToPage(p)">{{ p }}</button>
        </template>
        <button class="join-item btn btn-sm" :class="last ? 'btn-disabled' : 'hover:btn-primary transition-colors duration-200'" :disabled="last" @click="table.goToPage(meta.page + 1)">
          <MrcIcon name="chevron_right" />
        </button>
      </div>
    </div>
  </div>
</template>
