<script setup lang="ts">
/**
 * Grid label–nilai untuk isi baris expand (pengganti `getExpandView`).
 * Tipe: teks, gambar, tautan/tombol. Untuk konten bebas pakai slot `#expand`.
 */
import { getPath } from '@mrcatz/datatable-core';
import { useMrcatz } from '../config';
import { resolveImageUrl, TONE_BTN } from '../columns';
import type { ExpandField } from '../expand';
import MrcIcon from './MrcIcon.vue';
import MrcImage from './table/MrcImage.vue';

defineProps<{ row: any; fields: ExpandField[] }>();
const { imageBaseUrl } = useMrcatz();
const val = (row: any, f: ExpandField) => (f.value ? f.value(row) : f.key ? getPath(row, f.key) : undefined);
const spans = { 1: '', 2: 'sm:col-span-2', 3: 'sm:col-span-3' };
</script>

<template>
  <dl class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
    <div v-for="f in fields" :key="f.label" class="min-w-0" :class="spans[f.span ?? 1]">
      <dt class="text-base-content/60 text-xs">{{ f.label }}</dt>
      <dd class="mt-0.5 text-sm break-words">
        <MrcImage
          v-if="f.type === 'image'"
          :src="resolveImageUrl(val(row, f), imageBaseUrl)"
          :alt="f.label"
          :width="64"
          :height="64"
          img-class="rounded-box"
        />
        <a
          v-else-if="f.type === 'link'"
          :href="f.href?.(row) ?? String(val(row, f) ?? '#')"
          :class="[TONE_BTN[f.tone ?? 'primary'], 'btn-soft']"
          class="btn btn-xs"
          :target="f.newTab ? '_blank' : undefined"
          :rel="f.newTab ? 'noopener noreferrer' : undefined"
          :download="f.download || undefined"
          @click.stop
        >
          <MrcIcon v-if="f.icon" :name="f.icon" :size="13" />
          {{ f.linkLabel ?? f.label }}
        </a>
        <template v-else>{{ val(row, f) ?? '—' }}</template>
      </dd>
    </div>
  </dl>
</template>
