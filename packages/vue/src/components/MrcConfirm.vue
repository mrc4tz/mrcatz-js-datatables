<script setup lang="ts">
/** Dialog konfirmasi (hapus, reset, aksi massal mode konfirmasi). */
import { useMrcatz } from '../config';
import { TONE_BTN, type Tone } from '../columns';
import MrcModal from './MrcModal.vue';

withDefaults(
  defineProps<{
    title: string;
    description?: string;
    confirmLabel?: string;
    tone?: Tone;
    loading?: boolean;
  }>(),
  { tone: 'error' },
);
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ confirm: [] }>();
const { t } = useMrcatz();
const tones = TONE_BTN;
</script>

<template>
  <MrcModal v-model:open="open" size="sm" :dismissible="!loading">
    <div class="flex flex-col items-center gap-2 py-2 text-center">
      <div class="bg-error/10 text-error flex size-12 items-center justify-center rounded-full" :class="tone !== 'error' && 'bg-primary/10 text-primary'">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4" /><path d="M12 16h.01" /></svg>
      </div>
      <h3 class="text-base font-semibold">{{ title }}</h3>
      <p v-if="description" class="text-base-content/70 text-sm">{{ description }}</p>
      <slot />
    </div>
    <template #footer>
      <button type="button" class="btn btn-ghost btn-sm" :disabled="loading" @click="open = false">{{ t('action.cancel') }}</button>
      <button type="button" class="btn btn-sm" :class="tones[tone]" :disabled="loading" @click="emit('confirm')">
        <span v-if="loading" class="loading loading-spinner loading-xs" />
        {{ confirmLabel ?? t('action.yesDelete') }}
      </button>
    </template>
  </MrcModal>
</template>
