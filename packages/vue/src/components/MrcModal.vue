<script setup lang="ts">
/** Modal daisyUI berbasis `<dialog>` native (fokus & Escape ditangani browser). */
import { onMounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    /** Tutup saat klik backdrop. Default `true`. */
    dismissible?: boolean;
  }>(),
  { size: 'md', dismissible: true },
);
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();

const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-none w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] max-h-none' };

function sync(v: boolean) {
  const d = dialog.value;
  if (!d) return;
  if (v && !d.open) d.showModal?.();
  if (!v && d.open) d.close?.();
}
watch(open, sync);
onMounted(() => sync(open.value));

function onClose() {
  if (open.value) {
    open.value = false;
    emit('close');
  }
}
</script>

<template>
  <dialog ref="dialog" class="modal modal-bottom sm:modal-middle" @close="onClose" @cancel.prevent="onClose">
    <div class="modal-box flex max-h-[90vh] flex-col p-0" :class="widths[props.size]">
      <header v-if="title || $slots.header" class="border-base-content/10 flex items-start gap-3 border-b px-5 py-4">
        <slot name="header">
          <div class="min-w-0 flex-1">
            <h3 class="text-base font-semibold">{{ title }}</h3>
            <p v-if="subtitle" class="text-base-content/60 mt-0.5 text-sm">{{ subtitle }}</p>
          </div>
        </slot>
        <button type="button" class="btn btn-ghost btn-sm btn-square -mr-2" aria-label="Tutup" @click="onClose">✕</button>
      </header>
      <div class="flex-1 overflow-y-auto px-5 py-4">
        <slot v-if="open" />
      </div>
      <footer v-if="$slots.footer" class="border-base-content/10 flex flex-wrap justify-end gap-2 border-t px-5 py-3">
        <slot name="footer" />
      </footer>
    </div>
    <div class="modal-backdrop" @click="dismissible && onClose()" />
  </dialog>
</template>
