<script setup lang="ts">
/**
 * Notifikasi toast + lightbox gambar global — pasang SEKALI di layout
 * (pengganti `@include('mrcatz::components.ui.notification')`, yang juga
 * memuat lightbox). Toast tidak diperlukan bila `notify` diarahkan ke
 * sistem toast aplikasi, tapi lightbox tetap butuh komponen ini.
 */
import { ref, watch } from 'vue';
import { lightboxStore, removeToast, toastStore } from '../config';
import MrcIcon from './MrcIcon.vue';

const icons = { success: 'check_circle', info: 'info', warning: 'error', error: 'cancel' } as const;
const tones = { success: 'alert-success', info: 'alert-info', warning: 'alert-warning', error: 'alert-error' };

// ---------------------------------------------------------------- lightbox
const dialog = ref<HTMLDialogElement>();
const scale = ref(1);
let justReset = false;
watch(
  () => lightboxStore.url,
  (url) => {
    if (!url || !dialog.value) return;
    scale.value = 1;
    justReset = false;
    if (!dialog.value.open) dialog.value.showModal();
  },
);
function closeLightbox() {
  dialog.value?.close();
}
function onClosed() {
  lightboxStore.url = null;
  scale.value = 1;
}
function onBackdrop() {
  if (scale.value !== 1) {
    scale.value = 1;
    justReset = true;
  } else closeLightbox();
}
function onImage() {
  if (justReset) return void (justReset = false);
  onBackdrop();
}
function onWheel(e: WheelEvent) {
  scale.value = Math.min(5, Math.max(0.25, scale.value + (e.deltaY < 0 ? 0.15 : -0.15)));
}
</script>

<template>
  <div class="pointer-events-none fixed inset-0 z-50 flex h-screen w-screen flex-col-reverse items-end justify-start" aria-live="polite">
    <TransitionGroup
      enter-active-class="transition ease-in duration-200"
      enter-from-class="opacity-0 translate-y-2"
      leave-active-class="transition ease-out duration-500"
      leave-to-class="translate-x-full opacity-0"
    >
      <div
        v-for="n in toastStore.items"
        :key="n.id"
        role="alert"
        class="alert pointer-events-auto m-16 w-auto text-white"
        :class="tones[n.type]"
        @click="removeToast(n.id)"
      >
        <MrcIcon :name="icons[n.type]" />
        <span>{{ n.message }}</span>
      </div>
    </TransitionGroup>
  </div>

  <dialog
    ref="dialog"
    class="m-0 h-screen max-h-screen w-screen max-w-[100vw] border-0 bg-transparent p-0 outline-none backdrop:bg-black/85 backdrop:backdrop-blur-sm"
    @close="onClosed"
    @wheel.prevent="onWheel"
  >
    <div class="flex h-full w-full cursor-default items-center justify-center" @click.self="onBackdrop">
      <img
        v-if="lightboxStore.url"
        :src="lightboxStore.url"
        alt=""
        draggable="false"
        class="max-h-[85vh] max-w-[90vw] origin-center cursor-default rounded-lg shadow-2xl transition-transform duration-200 select-none"
        :style="{ transform: `scale(${scale})` }"
        @click.stop="onImage"
      />
    </div>
  </dialog>
</template>

