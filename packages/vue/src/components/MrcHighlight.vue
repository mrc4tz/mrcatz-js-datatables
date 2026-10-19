<script setup lang="ts">
/**
 * Sorot kata kunci di dalam teks (pengganti `setSearchWord`). Aman dari XSS —
 * teks dirender sebagai text node, bukan HTML. Warna bisa diatur lewat
 * `--mrc-highlight-bg` / `--mrc-highlight-color`.
 */
import { computed } from 'vue';
import { highlight } from '@mrcatz/datatable-core';

const props = defineProps<{ text: unknown; search: string }>();
const segments = computed(() => highlight(props.text, props.search));
</script>

<template>
  <template v-for="(s, i) in segments" :key="i">
    <mark
      v-if="s.match"
      class="mrc-highlight rounded-sm bg-[var(--mrc-highlight-bg,color-mix(in_oklab,var(--color-warning)_40%,transparent))] px-0.5 font-semibold text-[color:var(--mrc-highlight-color,inherit)]"
    >{{ s.text }}</mark>
    <template v-else>{{ s.text }}</template>
  </template>
</template>
