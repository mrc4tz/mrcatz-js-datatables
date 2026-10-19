<script setup lang="ts">
/**
 * Ikon SVG inline (gaya Lucide, stroke 2) — tanpa dependensi & tanpa CDN.
 */
import { computed } from 'vue';
import { iconPaths, type IconName } from '../icons';

const props = withDefaults(defineProps<{ name: IconName; size?: number | string }>(), { size: 16 });

const svg = computed(() => iconPaths[props.name]);
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="shrink-0"
    v-html="svg"
  />
</template>
