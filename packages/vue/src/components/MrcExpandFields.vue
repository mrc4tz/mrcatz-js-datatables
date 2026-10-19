<script setup lang="ts">
/** Isi baris expand (pengganti `getExpandView` / `datatable-expand.blade.php`). */
import { getPath } from '@mrcatz/datatable-core';
import { useMrcatz } from '../config';
import { resolveImageUrl, TONE_BTN } from '../columns';
import type { ExpandField } from '../expand';
import MrcIcon from './MrcIcon.vue';
import MrcImage from './table/MrcImage.vue';

defineProps<{ row: any; fields: ExpandField[] }>();
const { imageBaseUrl } = useMrcatz();
const val = (row: any, f: ExpandField) => (f.value ? f.value(row) : f.key ? getPath(row, f.key) : undefined);
const href = (row: any, f: ExpandField) => f.href?.(row) ?? String(val(row, f) ?? '#');
const target = (f: ExpandField) => f.target ?? (f.newTab ? '_blank' : undefined);
const rel = (f: ExpandField) => (target(f) === '_blank' ? 'noopener noreferrer' : undefined);
const html = (row: any, f: ExpandField) => (f.html ? f.html(row) : String(val(row, f) ?? ''));
/** Komponen fungsional kecil agar `render(row)` bisa dipakai di template. */
const Custom = (p: { row: any; field: ExpandField }) => p.field.render?.(p.row) ?? null;
</script>

<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <div v-for="f in fields" :key="f.label" class="bg-base-200/40 rounded-lg px-3 py-2" @click.stop>
      <span class="text-base-content/40 block text-[11px]" :class="f.type === 'link' ? 'mb-1.5' : f.type === 'image' || f.type === 'button' ? 'mb-1' : 'mb-0.5'">{{ f.label }}</span>

      <MrcImage
        v-if="f.type === 'image'"
        :src="resolveImageUrl(val(row, f), f.baseUrl ?? imageBaseUrl)"
        :fallback="f.fallbackKey ? String(getPath(row, f.fallbackKey) ?? '') : null"
        :width="f.width ?? 64"
        :height="f.height ?? 64"
        :img-class="f.previewClass ?? 'rounded-lg'"
        fallback-class="text-lg font-bold text-primary"
        align="left"
      />

      <a
        v-else-if="f.type === 'button'"
        :href="href(row, f)"
        class="link link-primary hover:link-hover inline-flex items-center gap-1.5 text-sm"
        :download="f.download || undefined"
        :target="target(f)"
        :rel="rel(f)"
      >
        <MrcIcon v-if="f.icon" :name="f.icon" :size="16" />
        {{ f.linkLabel ?? f.label }}
      </a>

      <a
        v-else-if="f.type === 'link'"
        :href="href(row, f)"
        class="btn btn-sm gap-1.5"
        :class="TONE_BTN[f.tone ?? 'ghost']"
        :download="f.download || undefined"
        :target="target(f)"
        :rel="rel(f)"
      >
        <MrcIcon v-if="f.icon" :name="f.icon" :size="16" />
        {{ f.linkLabel ?? f.label }}
      </a>

      <div v-else-if="f.type === 'html'" class="text-base-content/80 text-sm" v-html="html(row, f)" />

      <div v-else-if="f.type === 'custom'" class="text-base-content/80 text-sm"><Custom :row="row" :field="f" /></div>

      <span v-else class="text-base-content/80 text-sm">{{ val(row, f) ?? '-' }}</span>
    </div>
  </div>
</template>
