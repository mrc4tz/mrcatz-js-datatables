<script setup lang="ts">
/** Pratinjau gambar dengan lightbox; inisial sebagai cadangan bila gambar kosong/gagal. */
import { computed, ref } from 'vue';
import MrcModal from '../MrcModal.vue';

const props = withDefaults(
  defineProps<{ src: string | null; alt?: string; width?: number; height?: number; imgClass?: string; fallback?: string }>(),
  { width: 40, height: 40, imgClass: 'rounded-full' },
);
const failed = ref(false);
const open = ref(false);
const initial = computed(() => (props.fallback ?? props.alt ?? '?').trim().charAt(0).toUpperCase() || '?');
</script>

<template>
  <button
    v-if="src && !failed"
    type="button"
    class="inline-flex cursor-zoom-in overflow-hidden"
    :class="imgClass"
    :style="{ width: `${width}px`, height: `${height}px` }"
    @click.stop="open = true"
  >
    <img :src="src" :alt="alt ?? ''" loading="lazy" class="size-full object-cover" @error="failed = true" />
  </button>
  <span
    v-else
    class="bg-primary/10 text-primary inline-flex items-center justify-center text-sm font-semibold"
    :class="imgClass"
    :style="{ width: `${width}px`, height: `${height}px` }"
    aria-hidden="true"
  >
    {{ initial }}
  </span>
  <MrcModal v-if="src" v-model:open="open" size="lg" :title="alt">
    <img :src="src" :alt="alt ?? ''" class="mx-auto max-h-[70vh] rounded-box object-contain" />
  </MrcModal>
</template>
