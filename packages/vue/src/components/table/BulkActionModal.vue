<script setup lang="ts">
/** Modal aksi massal (pengganti `datatable-bulk-action.blade.php`): mode konfirmasi & mode form. */
import { computed, ref } from 'vue';
import { useMrcatz } from '../../config';
import type { BulkAction } from '../../bulk';
import type { FormValues } from '../../fields';
import type { FormErrors } from '../../validation';
import MrcIcon from '../MrcIcon.vue';
import MrcForm from '../form/MrcForm.vue';

const props = defineProps<{ action: BulkAction<any>; count: number; busy?: boolean }>();
const values = defineModel<FormValues>('values', { default: () => ({}) });
const errors = defineModel<FormErrors>('errors', { default: () => ({}) });
const emit = defineEmits<{ submit: [values: FormValues]; cancel: [] }>();
const { t } = useMrcatz();
const form = ref<InstanceType<typeof MrcForm>>();

// Kelas literal per warna agar terdeteksi Tailwind.
const tone = computed(() => props.action.tone ?? 'primary');
const soft: Record<string, string> = {
  primary: 'bg-primary/10 text-primary', secondary: 'bg-secondary/10 text-secondary', accent: 'bg-accent/10 text-accent',
  neutral: 'bg-neutral/10 text-neutral', info: 'bg-info/10 text-info', success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning', error: 'bg-error/10 text-error', ghost: 'bg-base-200 text-base-content',
};
const btn: Record<string, string> = {
  primary: 'btn-primary', secondary: 'btn-secondary', accent: 'btn-accent', neutral: 'btn-neutral', info: 'btn-info',
  success: 'btn-success', warning: 'btn-warning', error: 'btn-error', ghost: 'btn-ghost',
};
</script>

<template>
  <div class="modal modal-open modal-bottom sm:modal-middle" role="dialog" aria-modal="true">
    <!-- Mode konfirmasi -->
    <div v-if="action.mode !== 'form'" class="modal-box bg-base-100 max-w-sm rounded-t-2xl text-center shadow-2xl sm:rounded-2xl">
      <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" :class="soft[tone]">
        <MrcIcon :name="action.icon ?? 'edit'" :size="24" />
      </div>
      <h3 class="text-base-content mb-1 text-base font-bold">{{ action.title ?? action.label }}</h3>
      <p v-if="action.description" class="text-base-content/60 mb-5 text-sm">{{ action.description }}</p>
      <div v-else class="mb-5" />
      <p class="text-base-content/50 mb-5 text-xs">{{ count }} {{ t('bulk.selected') }}</p>
      <div class="flex justify-center gap-2">
        <button type="button" class="btn btn-ghost btn-sm" :disabled="busy" @click="emit('cancel')">{{ t('action.cancel') }}</button>
        <button type="button" class="btn btn-sm" :class="btn[tone]" :disabled="busy" @click="emit('submit', {})">
          <span v-if="busy" class="loading loading-spinner loading-xs" />
          {{ action.label }}
        </button>
      </div>
    </div>

    <!-- Mode form -->
    <div v-else class="modal-box bg-base-100 w-full max-w-2xl rounded-t-2xl shadow-2xl sm:rounded-2xl">
      <div class="border-base-content/10 mb-4 flex items-start justify-between border-b pb-3">
        <div class="flex min-w-0 items-center gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" :class="soft[tone]">
            <MrcIcon :name="action.icon ?? 'edit'" />
          </div>
          <div class="min-w-0">
            <h3 class="text-base-content truncate text-base font-bold">{{ action.title ?? action.label }}</h3>
            <p v-if="action.description" class="text-base-content/60 truncate text-xs">{{ action.description }}</p>
          </div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm btn-circle" :disabled="busy" @click="emit('cancel')"><MrcIcon name="close" /></button>
      </div>
      <div class="max-h-[60vh] overflow-y-auto pr-1">
        <MrcForm ref="form" v-model="values" v-model:errors="errors" :fields="action.fields ?? []" :readonly="busy" @submit="emit('submit', $event)" />
      </div>
      <div class="border-base-content/10 mt-5 flex items-center justify-between border-t pt-3">
        <span class="text-base-content/50 text-xs">{{ count }} {{ t('bulk.selected') }}</span>
        <div class="flex gap-2">
          <button type="button" class="btn btn-ghost btn-sm" :disabled="busy" @click="emit('cancel')">{{ t('action.cancel') }}</button>
          <button type="button" class="btn btn-sm gap-1" :class="btn[tone]" :disabled="busy" @click="form?.submit()">
            <span v-if="busy" class="loading loading-spinner loading-xs" />
            <MrcIcon v-else :name="action.icon ?? 'edit'" :size="16" />
            <span>{{ action.label }}</span>
          </button>
        </div>
      </div>
    </div>
    <div class="modal-backdrop" @click="!busy && emit('cancel')" />
  </div>
</template>
