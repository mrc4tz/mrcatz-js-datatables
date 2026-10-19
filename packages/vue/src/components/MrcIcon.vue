<script setup lang="ts">
/**
 * Ikon SVG inline (gaya Lucide, stroke 2) — tanpa dependensi & tanpa CDN.
 * Nama di luar set bawaan dirender sebagai ikon font Material Symbols.
 */
import { computed } from 'vue';
import { iconPaths, isBuiltinIcon, type IconName } from '../icons';

const props = withDefaults(defineProps<{ name: IconName; size?: number | string }>(), { size: 16 });

const svg = computed(() => (isBuiltinIcon(props.name) ? iconPaths[props.name] : null));
const fontSize = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size));
</script>

<template>
  <svg
    v-if="svg"
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
  <span
    v-else
    class="material-symbols-outlined shrink-0 leading-none select-none"
    :style="{ fontSize, width: fontSize, height: fontSize }"
    aria-hidden="true"
    >{{ name }}</span
  >
</template>
