<script setup lang="ts">
/** Menu tampil/sembunyi & urutan kolom (seret atau tombol ↑/↓). */
import { ref } from 'vue';
import { useMrcatz } from '../../config';
import type { DataTableController } from '../../composables/useDataTable';
import MrcPopover from '../MrcPopover.vue';
import MrcIcon from '../MrcIcon.vue';

const props = defineProps<{ table: DataTableController<any>; reorder?: boolean }>();
const { t } = useMrcatz();
const dragging = ref<string | null>(null);

function onDrop(targetIndex: number) {
  if (dragging.value) props.table.moveColumn(dragging.value, targetIndex);
  dragging.value = null;
}
</script>

<template>
  <MrcPopover align="end" width="16rem">
    <template #trigger="{ toggle, open }">
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-square border-base-content/15 border"
        :class="{ 'btn-active': open }"
        :title="t('column.toggle')"
        :aria-label="t('column.toggle')"
        @click="toggle"
      >
        <MrcIcon name="columns" />
      </button>
    </template>

    <div class="flex flex-col">
      <p class="text-base-content/60 px-2 pb-1 text-xs">{{ reorder ? t('column.dragHint') : t('column.toggle') }}</p>
      <ul class="max-h-72 overflow-y-auto">
        <li
          v-for="(c, i) in table.orderedColumns.value"
          :key="c.id"
          :draggable="reorder"
          class="hover:bg-base-200 flex items-center gap-2 rounded-field px-2 py-1.5 text-sm"
          :class="{ 'opacity-40': dragging === c.id }"
          @dragstart="dragging = c.id"
          @dragend="dragging = null"
          @dragover.prevent
          @drop.prevent="onDrop(i)"
        >
          <MrcIcon v-if="reorder" name="grip" :size="14" class="cursor-grab opacity-40" />
          <label class="flex flex-1 cursor-pointer items-center gap-2 truncate">
            <input
              type="checkbox"
              class="checkbox checkbox-xs checkbox-primary"
              :checked="!table.state.hidden.includes(c.id)"
              :disabled="c.pinned"
              @change="table.toggleColumn(c.id)"
            />
            <span class="truncate">{{ c.label || t('column.actions') }}</span>
          </label>
          <span v-if="reorder" class="flex">
            <button type="button" class="btn btn-ghost btn-xs btn-square" :disabled="i === 0" aria-label="Naik" @click="table.moveColumn(c.id, i - 1)">
              <MrcIcon name="chevron-up" :size="12" />
            </button>
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-square"
              :disabled="i === table.orderedColumns.value.length - 1"
              aria-label="Turun"
              @click="table.moveColumn(c.id, i + 1)"
            >
              <MrcIcon name="chevron-down" :size="12" />
            </button>
          </span>
        </li>
      </ul>
    </div>
  </MrcPopover>
</template>
