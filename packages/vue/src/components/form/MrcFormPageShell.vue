<script setup lang="ts">
/**
 * Bingkai form halaman penuh (pengganti `form-page.blade.php`): menggantikan
 * area tabel saat `form-page` aktif di `MrcCrudTable`. Header berisi judul +
 * tombol ×, footer lengket berisi Simpan/Batal. API-nya sejajar dengan
 * `MrcModal` (v-model:open, title, icon, slot default & footer) agar bisa
 * dipertukarkan.
 */
import { useMrcatz } from '../../config';
import type { IconName } from '../../icons';
import MrcIcon from '../MrcIcon.vue';

defineOptions({ inheritAttrs: false });
withDefaults(
  defineProps<{
    title?: string;
    icon?: IconName;
    /** Bayangan kartu (pengganti `$formPageCard`). Default true. */
    card?: boolean;
    /** Garis tepi (pengganti `$formPageBorder`). Default false. */
    border?: boolean;
  }>(),
  { card: true, border: false },
);
const open = defineModel<boolean>('open', { default: false });
const emit = defineEmits<{ dismiss: [] }>();
const { t } = useMrcatz();
</script>

<template>
  <div
    v-if="open"
    class="mrcatz-form-page bg-base-100 flex w-full flex-col overflow-hidden"
    :class="[card && 'md:rounded-xl md:shadow-md', border && 'md:border-base-content/10 md:rounded-xl md:border', !card && !border && 'md:rounded-xl']"
  >
    <div class="border-base-content/10 bg-base-200/40 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-4 md:px-6">
      <h2 class="text-base-content flex min-w-0 items-center gap-2 text-lg font-bold md:text-xl">
        <MrcIcon v-if="icon" :name="icon" class="text-primary" />
        <span class="truncate">{{ title }}</span>
      </h2>
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-circle hover:bg-base-200 shrink-0 transition-colors"
        :aria-label="t('action.cancel')"
        @click="emit('dismiss')"
      >
        <MrcIcon name="close" />
      </button>
    </div>
    <div class="px-4 py-6 md:px-8 md:py-8 lg:px-12">
      <div class="mx-auto max-w-5xl"><slot /></div>
    </div>
    <div class="border-base-content/10 bg-base-100/95 sticky bottom-0 flex shrink-0 flex-row-reverse items-center justify-start gap-2 border-t px-4 py-3 backdrop-blur-sm md:px-6">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
@keyframes mrcatzFormPageEnter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.mrcatz-form-page {
  animation: mrcatzFormPageEnter 220ms cubic-bezier(0.16, 1, 0.3, 1);
}
@media (prefers-reduced-motion: reduce) {
  .mrcatz-form-page {
    animation: none;
  }
}
</style>
