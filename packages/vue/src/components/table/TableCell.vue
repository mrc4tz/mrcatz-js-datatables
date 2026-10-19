<script setup lang="ts">
/** Isi satu sel sesuai jenis kolom. Slot `#cell-{id}` ditangani oleh induknya. */
import { computed, h, type FunctionalComponent, type VNodeChild } from 'vue';
import { getPath } from '@mrcatz/datatable-core';
import { useMrcatz } from '../../config';
import { allowed, cellValue, displayValue, resolveImageUrl, TONE_BTN, type CellContext, type ColumnDef, type Tone } from '../../columns';
import MrcHighlight from '../MrcHighlight.vue';
import MrcIcon from '../MrcIcon.vue';
import MrcImage from './MrcImage.vue';

const props = defineProps<{ column: ColumnDef<any>; row: any; ctx: CellContext }>();
const emit = defineEmits<{ edit: []; delete: [] }>();
const { t, imageBaseUrl } = useMrcatz();

const text = computed(() => displayValue(props.column, props.row));
const tone = computed<Tone | null>(() => {
  const b = props.column.badge;
  if (!b) return null;
  const v = cellValue(props.column, props.row);
  return typeof b === 'function' ? b(v, props.row) : (b[String(v)] ?? 'neutral');
});
const badgeClass: Record<Tone, string> = {
  neutral: 'badge-neutral', primary: 'badge-primary', secondary: 'badge-secondary', accent: 'badge-accent',
  info: 'badge-info', success: 'badge-success', warning: 'badge-warning', error: 'badge-error', ghost: 'badge-ghost',
};

const canEdit = computed(() => allowed(props.column.actions?.edit, props.row));
const canDelete = computed(() => allowed(props.column.actions?.delete, props.row));
const extras = computed(() => (props.column.actions?.extra ?? []).filter((a) => allowed(a.when, props.row)));

const image = computed(() => {
  const c = props.column.image!;
  return {
    src: resolveImageUrl(cellValue(props.column, props.row), c.baseUrl ?? imageBaseUrl),
    fallback: c.fallbackKey ? String(getPath(props.row, c.fallbackKey) ?? '') : null,
  };
});

/** Bungkus hasil `render()` (VNodeChild) agar bisa dipakai sebagai komponen. */
const Rendered: FunctionalComponent<{ content: VNodeChild }> = (p) => h('span', { class: 'contents' }, p.content as never);
</script>

<template>
  <template v-if="column.kind === 'rowNumber'">{{ ctx.number }}</template>

  <template v-else-if="column.kind === 'actions'">
    <span v-if="!canEdit && !canDelete && !extras.length" class="text-base-content/30 text-xs">—</span>
    <div v-else class="flex justify-center gap-1">
      <button
        v-for="a in extras"
        :key="a.id"
        type="button"
        class="mrcatz-action btn btn-ghost btn-sm btn-square tooltip tooltip-top transition-colors duration-200"
        :class="a.tone ? TONE_BTN[a.tone].replace('btn-', 'text-') : 'text-base-content/70'"
        :data-tip="a.label"
        :aria-label="a.label"
        @click.stop="a.onClick(row)"
      >
        <MrcIcon v-if="a.icon" :name="a.icon" />
        <span v-else class="text-xs">{{ a.label }}</span>
      </button>
      <button
        v-if="canEdit"
        type="button"
        class="mrcatz-action btn btn-ghost btn-sm btn-square text-primary hover:bg-primary/10 tooltip tooltip-top transition-colors duration-200"
        :data-tip="t('action.edit')"
        :aria-label="t('action.edit')"
        @click.stop="emit('edit')"
      >
        <MrcIcon name="edit" />
      </button>
      <button
        v-if="canDelete"
        type="button"
        class="mrcatz-action btn btn-ghost btn-sm btn-square text-error hover:bg-error/10 tooltip tooltip-top transition-colors duration-200"
        :data-tip="t('action.delete')"
        :aria-label="t('action.delete')"
        @click.stop="emit('delete')"
      >
        <MrcIcon name="delete" />
      </button>
    </div>
  </template>

  <MrcImage
    v-else-if="column.kind === 'image'"
    :src="image.src"
    :fallback="image.fallback"
    :width="column.image?.width"
    :height="column.image?.height"
    :img-class="column.image?.class"
    :align="column.align"
  />

  <Rendered v-else-if="column.render" :content="column.render(row, ctx)" />

  <span
    v-else-if="tone"
    class="badge badge-sm max-w-full truncate whitespace-nowrap"
    :class="[
      badgeClass[tone],
      { 'badge-soft': (column.badgeVariant ?? 'soft') === 'soft', 'badge-outline': column.badgeVariant === 'outline', uppercase: column.uppercase },
      column.badgeClass,
    ]"
  >
    <MrcHighlight v-if="column.highlight !== false && ctx.search" :text="text" :search="ctx.search" />
    <template v-else>{{ text }}</template>
  </span>

  <template v-else>
    <MrcHighlight v-if="column.highlight !== false && ctx.search" :text="text" :search="ctx.search" />
    <template v-else>{{ text }}</template>
  </template>
</template>
