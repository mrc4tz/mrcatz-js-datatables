<script setup lang="ts">
/**
 * Breadcrumb (pengganti `mrcatz::components.ui.breadcrumbs`). Item dengan `to`
 * menjadi tautan (RouterLink/NuxtLink bila router terpasang), item terakhir
 * tanpa `to` tampil sebagai halaman aktif.
 */
import { getCurrentInstance, resolveDynamicComponent } from 'vue';
import type { BreadcrumbItem } from '../types';
import MrcIcon from './MrcIcon.vue';

defineProps<{ items: BreadcrumbItem[] }>();

const hasRouter = !!getCurrentInstance()?.appContext.config.globalProperties.$router;
const Link = hasRouter ? resolveDynamicComponent('RouterLink') : 'a';
</script>

<template>
  <nav v-if="items.length" class="breadcrumbs mb-6 text-sm" aria-label="Breadcrumb">
    <ul>
      <li v-for="(b, i) in items" :key="i">
        <component
          :is="Link"
          v-if="b.to"
          v-bind="hasRouter ? { to: b.to } : { href: b.to }"
          class="text-primary hover:text-primary/80 flex items-center gap-1 font-semibold transition-colors"
        >
          <MrcIcon v-if="i === 0" name="home" :size="14" />
          {{ b.title }}
        </component>
        <span v-else class="text-base-content/50" aria-current="page">{{ b.title }}</span>
      </li>
    </ul>
  </nav>
</template>
