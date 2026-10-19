<script setup lang="ts">
/**
 * Sel yang bisa diedit langsung (pengganti `partials/inline-edit.blade.php`):
 * kotak bergaris putus-putus + ikon pensil; klik dua kali (desktop) atau
 * ketuk (mobile) untuk mengedit, Enter simpan, Escape batal.
 */
import { nextTick, ref } from 'vue';
import type { InlineEditConfig } from '../../columns';

const props = defineProps<{
  config: InlineEditConfig<any>;
  value: unknown;
  row: unknown;
  /** Simpan nilai; kembalikan pesan error untuk ditampilkan, atau null bila berhasil. */
  save: (value: string) => Promise<string | null>;
  /** Tampilan kartu mobile: satu klik langsung edit. */
  compact?: boolean;
}>();

const editing = ref(false);
const saving = ref(false);
const error = ref('');
const draft = ref('');
const input = ref<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>();

async function start() {
  draft.value = props.value === null || props.value === undefined ? '' : String(props.value);
  error.value = '';
  editing.value = true;
  await nextTick();
  input.value?.focus();
}
function onClick() {
  if (!editing.value && (props.compact || window.innerWidth < 768)) void start();
}
function cancel() {
  editing.value = false;
  error.value = '';
}
async function submit() {
  const invalid = props.config.validate?.(draft.value, props.row);
  if (typeof invalid === 'string') {
    error.value = invalid;
    return;
  }
  if (draft.value === String(props.value ?? '')) return cancel();
  editing.value = false;
  saving.value = true;
  const err = await props.save(draft.value);
  saving.value = false;
  if (err) {
    error.value = err;
    editing.value = true;
    await nextTick();
    input.value?.focus();
  }
}
function onBlur() {
  if (!error.value) editing.value = false;
}
</script>

<template>
  <div @dblclick.stop="start" @click.stop="onClick">
    <span
      v-if="!editing && !saving"
      class="group/edit bg-primary/5 hover:bg-primary/10 border-primary/20 hover:border-primary/40 inline-flex cursor-text items-center gap-1.5 rounded border border-dashed transition-all duration-150"
      :class="compact ? 'px-1.5 py-0.5' : '-mx-2 px-2 py-0.5'"
    >
      <span><slot /></span>
      <svg
        class="text-primary/30 group-hover/edit:text-primary/60 h-3 w-3 shrink-0 transition-colors"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
      </svg>
    </span>
    <span v-if="saving" class="text-base-content/40 -mx-2 inline-flex items-center gap-1.5 px-2 py-0.5">
      <span class="loading loading-spinner loading-xs" />
    </span>
    <div v-if="editing" class="inline-flex flex-col" @click.stop>
      <select
        v-if="config.input === 'select'"
        ref="input"
        v-model="draft"
        class="select select-xs select-bordered w-full max-w-[200px] text-sm"
        :class="{ 'select-error': error }"
        @keydown.enter.prevent="submit"
        @keydown.escape.prevent="cancel"
        @change="submit"
        @blur="onBlur"
      >
        <option v-for="o in config.options ?? []" :key="String(o.value)" :value="String(o.value)">{{ o.label }}</option>
      </select>
      <input
        v-else
        ref="input"
        v-model="draft"
        :type="config.input === 'number' ? 'number' : config.input === 'date' ? 'date' : 'text'"
        class="input input-xs input-bordered w-full max-w-[200px] text-sm"
        :class="{ 'input-error': error }"
        @keydown.enter.prevent="submit"
        @keydown.escape.prevent="cancel"
        @blur="onBlur"
      />
      <span v-if="error" role="alert" aria-live="assertive" class="text-error mt-0.5 max-w-[200px] text-xs">{{ error }}</span>
    </div>
  </div>
</template>
