<script setup lang="ts">
/**
 * Modal daisyUI berbasis `<dialog>` — gaya sama dengan modal mrcatz/datatable
 * versi Laravel: header ber-ikon dengan garis bawah, isi bergulir, footer
 * `modal-action` bergaris atas.
 */
import { onMounted, ref, watch } from 'vue';
import type { IconName } from '../icons';
import MrcIcon from './MrcIcon.vue';

const props = withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    icon?: IconName;
    /** Lebar kotak: `sm` (konfirmasi), `md` (default), `lg` (form), `full`. */
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    /** Tutup saat klik backdrop / tombol Esc. */
    dismissible?: boolean;
    /** Kelas tambahan kotak modal. */
    boxClass?: string;
    /** Tinggi maks area isi sebelum bergulir. */
    bodyClass?: string;
  }>(),
  { size: 'md', dismissible: true, bodyClass: 'max-h-[60vh] overflow-y-auto pr-1 -mr-1' },
);
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement>();

const widths = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'w-full max-w-3xl lg:max-w-4xl',
  xl: 'w-full max-w-5xl',
  full: 'max-w-none w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] max-h-none',
};

function sync(v: boolean) {
  const d = dialog.value;
  if (!d) return;
  if (v && !d.open) d.showModal?.();
  if (!v && d.open) d.close?.();
}
watch(open, sync);
onMounted(() => sync(open.value));

function close() {
  if (open.value) {
    open.value = false;
    emit('close');
  }
}
function onCancel(e: Event) {
  e.preventDefault();
  if (props.dismissible) close();
}
</script>

<template>
  <dialog ref="dialog" class="modal modal-bottom sm:modal-middle" aria-modal="true" @close="close" @cancel="onCancel">
    <div class="modal-box bg-base-100 rounded-t-2xl shadow-2xl sm:rounded-2xl" :class="[widths[size], boxClass]">
      <div v-if="title || $slots.header" class="border-base-content/10 mb-4 flex items-center justify-between border-b pb-4">
        <slot name="header">
          <div class="min-w-0">
            <h3 class="text-base-content flex items-center gap-2 text-lg font-bold">
              <MrcIcon v-if="icon" :name="icon" class="text-primary" />
              {{ title }}
            </h3>
            <p v-if="subtitle" class="text-base-content/50 mt-0.5 text-sm">{{ subtitle }}</p>
          </div>
        </slot>
        <button type="button" class="btn btn-ghost btn-sm btn-circle hover:bg-base-200 transition-colors" aria-label="Tutup" @click="close">
          <MrcIcon name="close" />
        </button>
      </div>

      <div :class="bodyClass">
        <slot v-if="open" />
      </div>

      <div v-if="$slots.footer" class="modal-action border-base-content/10 mt-4 border-t pt-4">
        <slot name="footer" />
      </div>
    </div>
    <div class="modal-backdrop" @click="dismissible && close()" />
  </dialog>
</template>
