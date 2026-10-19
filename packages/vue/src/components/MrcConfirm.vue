<script setup lang="ts">
/**
 * Dialog konfirmasi, dua varian sesuai versi Laravel:
 * - `large`  — konfirmasi hapus satu data (ikon 16, tombol besar, label data di bawah teks)
 * - `compact` — reset & hapus massal (ikon 14, `max-w-sm`, tombol kecil)
 */
import { useMrcatz } from '../config';
import { TONE_BTN, type Tone } from '../columns';
import type { IconName } from '../icons';
import MrcIcon from './MrcIcon.vue';
import MrcModal from './MrcModal.vue';

withDefaults(
  defineProps<{
    title: string;
    description?: string;
    /** Teks tebal di bawah deskripsi (mis. nama data yang dihapus). */
    detail?: string;
    confirmLabel?: string;
    confirmIcon?: IconName;
    icon?: IconName;
    tone?: Tone;
    variant?: 'large' | 'compact';
    loading?: boolean;
    /** Tutup saat klik di luar / Esc. Default true. */
    dismissible?: boolean;
  }>(),
  { tone: 'error', icon: 'warning', variant: 'compact', dismissible: true },
);
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ confirm: [] }>();
const { t } = useMrcatz();
const soft: Record<string, string> = {
  error: 'bg-error/10 text-error',
  warning: 'bg-warning/10 text-warning',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  info: 'bg-info/10 text-info',
  secondary: 'bg-secondary/10 text-secondary',
};
</script>

<template>
  <MrcModal v-model:open="open" :size="variant === 'compact' ? 'sm' : 'md'" :dismissible="dismissible && !loading" body-class="" :box-class="variant === 'compact' ? 'text-center' : ''">
    <template v-if="variant === 'large'">
      <div class="mb-4 flex justify-center">
        <div class="flex h-16 w-16 items-center justify-center rounded-full" :class="soft[tone] ?? soft.error">
          <MrcIcon :name="icon" :size="30" />
        </div>
      </div>
      <h3 class="text-base-content text-center text-lg font-bold">{{ title }}</h3>
      <p class="text-base-content/60 py-4 text-center text-sm">
        {{ description }}<template v-if="detail"><br /><span class="text-base-content mt-1 inline-block font-semibold">{{ detail }}</span></template>
      </p>
      <slot />
      <div class="modal-action justify-center gap-3">
        <button type="button" class="btn gap-2 px-6 shadow-sm" :class="TONE_BTN[tone]" :disabled="loading" @click="emit('confirm')">
          <span v-if="loading" class="loading loading-spinner loading-xs" />
          <MrcIcon v-else :name="confirmIcon ?? 'delete_forever'" />
          {{ confirmLabel ?? t('action.yesDelete') }}
        </button>
        <button type="button" class="btn btn-ghost" :disabled="loading" @click="open = false">{{ t('action.cancel') }}</button>
      </div>
    </template>

    <template v-else>
      <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" :class="soft[tone] ?? soft.error">
        <MrcIcon :name="icon" :size="24" />
      </div>
      <h3 class="text-base-content mb-1 text-base font-bold">{{ title }}</h3>
      <p class="text-base-content/50 mb-6 text-sm">{{ description }}</p>
      <slot />
      <div class="flex justify-center gap-2">
        <button type="button" class="btn btn-ghost btn-sm" :disabled="loading" @click="open = false">{{ t('action.cancel') }}</button>
        <button type="button" class="btn btn-sm" :class="TONE_BTN[tone]" :disabled="loading" @click="emit('confirm')">
          <span v-if="loading" class="loading loading-spinner loading-xs" />
          {{ confirmLabel ?? t('action.yesDelete') }}
        </button>
      </div>
    </template>
  </MrcModal>
</template>
