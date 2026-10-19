<script setup lang="ts">
/**
 * Pratinjau gambar (pengganti `datatable-image.blade.php`): klik membuka
 * lightbox global, inisial sebagai cadangan bila gambar kosong/gagal dimuat.
 */
import { computed, ref, watch } from 'vue';
import { openLightbox } from '../../config';
import MrcIcon from '../MrcIcon.vue';

const props = withDefaults(
  defineProps<{
    src: string | null;
    alt?: string;
    width?: number;
    height?: number;
    imgClass?: string;
    /** Teks untuk inisial; tanpa ini tampil ikon orang. */
    fallback?: string | null;
    /** Kelas teks inisial. */
    fallbackClass?: string;
    align?: 'left' | 'center' | 'right';
  }>(),
  { width: 40, height: 40, imgClass: 'rounded-full', fallbackClass: 'text-xs font-bold text-primary', align: 'center' },
);
const failed = ref(false);
watch(
  () => props.src,
  () => (failed.value = false),
);
const url = computed(() => (props.src && !failed.value ? props.src : null));
const initial = computed(() => (props.fallback ?? '').trim().charAt(0).toUpperCase());
const justify = { left: 'justify-start', center: 'justify-center', right: 'justify-end' };
</script>

<template>
  <div class="flex items-center" :class="justify[align]" @click.stop>
    <div
      class="shrink-0 overflow-hidden"
      :class="[imgClass, url && 'cursor-zoom-in transition-opacity hover:opacity-80']"
      :style="{ width: `${width}px`, height: `${height}px` }"
      @click="url && openLightbox(url)"
    >
      <img v-if="url" :src="url" :alt="alt ?? ''" loading="lazy" class="block h-full w-full object-cover object-center" @error="failed = true" />
      <div v-else-if="initial" class="bg-primary/10 flex h-full w-full items-center justify-center">
        <span :class="fallbackClass">{{ initial }}</span>
      </div>
      <div v-else class="bg-base-300 flex h-full w-full items-center justify-center leading-none">
        <MrcIcon name="person" :size="Math.max(16, Math.round(Math.min(width, height) * 0.4))" class="text-base-content/30" />
      </div>
    </div>
  </div>
</template>
