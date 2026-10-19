<script setup lang="ts">
/**
 * Pilihan banyak berupa tombol — port `partials/form/chooser.blade.php`.
 * Nilai berupa array; kotak pencarian muncul bila opsi lebih dari 10.
 */
import { computed, ref } from 'vue';
import { useMrcatz } from '../../../config';
import type { FieldOption } from '../../../fields';

const props = defineProps<{ options: FieldOption[]; modelValue?: unknown[] | null; disabled?: boolean; invalid?: boolean; name: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: unknown[]] }>();
const { t } = useMrcatz();

const search = ref('');
const searchable = computed(() => props.options.length > 10);
const selected = computed(() => (Array.isArray(props.modelValue) ? props.modelValue : []));
const visible = (o: FieldOption) => !search.value || o.label.toLowerCase().includes(search.value.toLowerCase());
const isChecked = (o: FieldOption) => selected.value.some((v) => String(v) === String(o.value));

function toggle(o: FieldOption, checked: boolean) {
  const rest = selected.value.filter((v) => String(v) !== String(o.value));
  // Pertahankan urutan sesuai opsi agar payload stabil.
  const next = checked ? props.options.filter((x) => isChecked(x) || x === o).map((x) => x.value) : rest;
  emit('update:modelValue', next);
}
</script>

<template>
  <div class="border-base-content/15 bg-base-200/30 rounded-lg border p-4" :class="invalid && 'border-error'">
    <input
      v-if="searchable"
      v-model="search"
      type="text"
      :placeholder="t('form.chooserSearch')"
      class="input input-sm input-bordered bg-base-100 mb-3 w-full"
    />
    <div class="flex flex-wrap gap-2">
      <template v-for="o in options" :key="String(o.value)">
        <input
          v-show="visible(o)"
          class="btn btn-sm transition-all duration-200"
          type="checkbox"
          :name="name"
          :value="String(o.value)"
          :aria-label="o.label"
          :checked="isChecked(o)"
          :disabled="disabled"
          @change="toggle(o, ($event.target as HTMLInputElement).checked)"
        />
      </template>
    </div>
  </div>
</template>
