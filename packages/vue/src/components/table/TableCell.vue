<script setup lang="ts">
/** Isi satu sel sesuai jenis kolom. Slot `#cell-{id}` ditangani oleh induknya. */
import { computed, h, type FunctionalComponent, type VNodeChild } from 'vue';
import { getPath } from '@mrcatz/datatable-core';
import { useMrcatz } from '../../config';
import { allowed, cellValue, displayValue, resolveImageUrl, type CellContext, type ColumnDef, type Tone } from '../../columns';
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
const btnTone: Record<Tone, string> = {
  neutral: '', primary: 'text-primary', secondary: 'text-secondary', accent: 'text-accent',
  info: 'text-info', success: 'text-success', warning: 'text-warning', error: 'text-error', ghost: '',
};

const canEdit = computed(() => allowed(props.column.actions?.edit, props.row));
const canDelete = computed(() => allowed(props.column.actions?.delete, props.row));
const extras = computed(() => (props.column.actions?.extra ?? []).filter((a) => allowed(a.when, props.row)));

const image = computed(() => {
  const c = props.column.image!;
  return {
    src: resolveImageUrl(cellValue(props.column, props.row), c.baseUrl ?? imageBaseUrl),
    fallback: c.fallbackKey ? String(getPath(props.row, c.fallbackKey) ?? '') : undefined,
  };
});

/** Bungkus hasil `render()` (VNodeChild) agar bisa dipakai sebagai komponen. */
const Rendered: FunctionalComponent<{ content: VNodeChild }> = (p) => h('span', { class: 'contents' }, p.content as never);
</script>

<template>
  <template v-if="column.kind === 'rowNumber'">
    <span class="text-base-content/60 tabular-nums">{{ ctx.number }}</span>
  </template>

  <template v-else-if="column.kind === 'actions'">
    <span v-if="!canEdit && !canDelete && !extras.length" class="text-base-content/30 text-xs">—</span>
    <span v-else class="inline-flex items-center gap-0.5">
      <button
        v-for="a in extras"
        :key="a.id"
        type="button"
        class="btn btn-ghost btn-xs btn-square"
        :class="btnTone[a.tone ?? 'neutral']"
        :title="a.label"
        :aria-label="a.label"
        @click.stop="a.onClick(row)"
      >
        <MrcIcon v-if="a.icon" :name="a.icon" :size="15" />
        <span v-else class="text-xs">{{ a.label }}</span>
      </button>
      <button v-if="canEdit" type="button" class="btn btn-ghost btn-xs btn-square text-info" :title="t('action.edit')" :aria-label="t('action.edit')" @click.stop="emit('edit')">
        <MrcIcon name="pencil" :size="15" />
      </button>
      <button v-if="canDelete" type="button" class="btn btn-ghost btn-xs btn-square text-error" :title="t('action.delete')" :aria-label="t('action.delete')" @click.stop="emit('delete')">
        <MrcIcon name="trash" :size="15" />
      </button>
    </span>
  </template>

  <template v-else-if="column.kind === 'image'">
    <MrcImage
      :src="image.src"
      :alt="image.fallback ?? column.label"
      :fallback="image.fallback"
      :width="column.image?.width"
      :height="column.image?.height"
      :img-class="column.image?.class"
    />
  </template>

  <Rendered v-else-if="column.render" :content="column.render(row, ctx)" />

  <span
    v-else-if="tone"
    class="badge badge-sm whitespace-nowrap"
    :class="[badgeClass[tone], { 'badge-soft': (column.badgeVariant ?? 'soft') === 'soft', 'badge-outline': column.badgeVariant === 'outline', uppercase: column.uppercase }]"
  >
    <MrcHighlight v-if="column.highlight !== false" :text="text" :search="ctx.search" />
    <template v-else>{{ text }}</template>
  </span>

  <span v-else :class="{ uppercase: column.uppercase }">
    <MrcHighlight v-if="column.highlight !== false && ctx.search" :text="text" :search="ctx.search" />
    <template v-else>{{ text }}</template>
  </span>
</template>
