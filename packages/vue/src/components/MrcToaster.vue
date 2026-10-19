<script setup lang="ts">
/**
 * Toast bawaan (pengganti `@include('mrcatz::components.ui.notification')`).
 * Pasang sekali di layout. Tidak diperlukan bila `notify` diarahkan ke
 * sistem toast milik aplikasi.
 */
import { toastStore } from '../config';

const tones = { success: 'alert-success', error: 'alert-error', warning: 'alert-warning', info: 'alert-info' };
</script>

<template>
  <div class="toast toast-end toast-bottom z-[100]" aria-live="polite">
    <TransitionGroup
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 translate-y-2"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div v-for="item in toastStore.items" :key="item.id" role="status" class="alert alert-soft shadow-md" :class="tones[item.type]">
        <span class="text-sm">{{ item.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>
