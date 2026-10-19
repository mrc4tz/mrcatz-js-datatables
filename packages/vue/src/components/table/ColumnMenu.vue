<script setup lang="ts">
/** Daftar tampil/sembunyi kolom (isi dropdown "Kolom" & bottom-sheet mobile). */
import type { DataTableController } from '../../composables/useDataTable';
import { useMrcatz } from '../../config';

defineProps<{ table: DataTableController<any>; sheet?: boolean }>();
const { t } = useMrcatz();
</script>

<template>
  <div class="space-y-1">
    <p v-if="!sheet" class="text-base-content/50 mb-2 text-xs font-semibold tracking-wide uppercase">{{ t('column.toggle') }}</p>
    <label
      v-for="c in table.columns.value"
      :key="c.id"
      class="hover:bg-base-200/50 flex cursor-pointer items-center rounded-lg"
      :class="sheet ? 'active:bg-base-200/70 gap-3 px-3 py-3' : 'gap-2 px-2 py-1.5'"
    >
      <input
        type="checkbox"
        class="checkbox checkbox-primary"
        :class="sheet ? 'checkbox-sm' : 'checkbox-xs'"
        :checked="!table.state.hidden.includes(c.id)"
        :disabled="c.pinned"
        @change="table.toggleColumn(c.id)"
      />
      <span class="text-base-content/70 text-sm">{{ c.label || t('column.actions') }}</span>
    </label>
  </div>
</template>
