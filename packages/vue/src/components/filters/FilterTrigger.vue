<script setup lang="ts">
/** Tombol pemicu filter popover (rentang tanggal / multi) — gaya sama dengan versi Laravel. */
import MrcIcon from '../MrcIcon.vue';

defineProps<{ text: string; icon?: string; active?: boolean; hasValue?: boolean; clearLabel?: string }>();
const emit = defineEmits<{ toggle: []; clear: [] }>();
</script>

<template>
  <button
    type="button"
    class="border-base-content/20 bg-base-100 hover:border-primary focus:border-primary flex h-8 w-full items-center justify-between gap-2 rounded-lg border px-3 text-sm transition-colors focus:outline-none"
    :class="{ 'border-primary': active }"
    @click="emit('toggle')"
  >
    <span class="flex min-w-0 flex-1 items-center gap-2" :title="text">
      <MrcIcon v-if="icon" :name="icon" :size="16" class="text-base-content/50" />
      <span class="truncate text-left">{{ text }}</span>
    </span>
    <span class="flex shrink-0 items-center gap-1">
      <span
        v-if="hasValue"
        role="button"
        tabindex="0"
        class="hover:bg-base-200 inline-flex cursor-pointer items-center justify-center rounded-full p-0.5 transition"
        :title="clearLabel"
        @click.stop="emit('clear')"
        @keydown.enter.stop.prevent="emit('clear')"
      >
        <MrcIcon name="close" :size="14" class="text-base-content/40" />
      </span>
      <MrcIcon name="expand_more" :size="16" class="text-base-content/40" />
    </span>
  </button>
</template>
