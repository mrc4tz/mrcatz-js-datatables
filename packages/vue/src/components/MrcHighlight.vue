<script setup lang="ts">
/**
 * Sorot kata kunci di dalam teks (pengganti `setSearchWord`). Aman dari XSS —
 * teks dirender sebagai text node. Warna sama dengan versi Laravel dan bisa
 * diatur lewat `--mrcatz-highlight-bg` / `--mrcatz-highlight-color`.
 */
import { computed } from 'vue';
import { highlight } from '@mrcatz/datatable-core';

const props = defineProps<{ text: unknown; search: string }>();
const segments = computed(() => highlight(props.text, props.search));
const style = {
  backgroundColor: 'var(--mrcatz-highlight-bg, rgba(250, 204, 21, 0.4))',
  color: 'var(--mrcatz-highlight-color, inherit)',
  borderRadius: '0.25rem',
  padding: '0 0.15rem',
  fontWeight: 600,
};
</script>

<template>
  <template v-for="(s, i) in segments" :key="i">
    <span v-if="s.match" class="mrcatz-search-highlight" :style="style">{{ s.text }}</span>
    <template v-else>{{ s.text }}</template>
  </template>
</template>
