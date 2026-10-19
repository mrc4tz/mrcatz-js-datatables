<script setup lang="ts">
/** Editor sel inline: Enter simpan, Escape batal, blur simpan. */
import { nextTick, onMounted, ref } from 'vue';
import type { InlineEditConfig } from '../../columns';

const props = defineProps<{ config: InlineEditConfig<any>; initial: unknown; error?: string | null; saving?: boolean }>();
const emit = defineEmits<{ save: [value: string]; cancel: [] }>();

const draft = ref(props.initial === null || props.initial === undefined ? '' : String(props.initial));
const el = ref<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>();
let done = false;

onMounted(async () => {
  await nextTick();
  el.value?.focus();
  if (el.value instanceof HTMLInputElement) el.value.select();
});

function save() {
  if (done) return;
  done = true;
  emit('save', draft.value);
  // Bila validasi gagal, induk tetap membuka editor; izinkan simpan ulang.
  setTimeout(() => (done = false), 0);
}
function cancel() {
  done = true;
  emit('cancel');
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    cancel();
  } else if (e.key === 'Enter' && !(props.config.input === 'textarea' && e.shiftKey)) {
    e.preventDefault();
    save();
  }
}
</script>

<template>
  <div class="relative min-w-32" @click.stop @dblclick.stop>
    <select
      v-if="config.input === 'select'"
      ref="el"
      v-model="draft"
      class="select select-xs w-full"
      :class="{ 'select-error': error }"
      :disabled="saving"
      @keydown="onKey"
      @change="save"
      @blur="cancel"
    >
      <option v-for="o in config.options ?? []" :key="o.value" :value="String(o.value)">{{ o.label }}</option>
    </select>
    <textarea
      v-else-if="config.input === 'textarea'"
      ref="el"
      v-model="draft"
      rows="2"
      class="textarea textarea-xs w-full"
      :class="{ 'textarea-error': error }"
      :disabled="saving"
      @keydown="onKey"
      @blur="save"
    />
    <input
      v-else
      ref="el"
      v-model="draft"
      :type="config.input ?? 'text'"
      class="input input-xs w-full"
      :class="{ 'input-error': error }"
      :disabled="saving"
      @keydown="onKey"
      @blur="save"
    />
    <span v-if="saving" class="loading loading-spinner loading-xs absolute top-1/2 right-1.5 -translate-y-1/2" />
    <p v-if="error" class="text-error mt-0.5 text-xs" role="alert">{{ error }}</p>
  </div>
</template>
