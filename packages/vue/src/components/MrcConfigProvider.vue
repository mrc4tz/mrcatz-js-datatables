<script setup lang="ts">
/**
 * Konfigurasi MrCatz untuk sebagian halaman saja (mis. tabel berbahasa Inggris
 * di aplikasi berbahasa Indonesia). Opsi sama dengan `createMrcatz()`.
 *
 * <MrcConfigProvider :options="{ locale: 'en' }"><MrcDataTable ... /></MrcConfigProvider>
 */
import { provide } from 'vue';
import { createContext, MRCATZ_KEY, type MrcatzOptions } from '../config';

const props = defineProps<{ options: MrcatzOptions }>();
provide(MRCATZ_KEY, createContext(props.options));
</script>

<template>
  <slot />
</template>
