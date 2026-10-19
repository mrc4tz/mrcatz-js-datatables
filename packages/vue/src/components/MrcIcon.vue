<script setup lang="ts">
/**
 * Ikon MrCatz. Set ikon diatur lewat `createMrcatz({ icons: { set } })`
 * (pengganti `icon_set` di `config/mrcatz.php`):
 * - `default`/`heroicons`: SVG inline Heroicons outline (stroke 1.5), tanpa dependensi.
 * - `material`: ikon font Material; `fontawesome`: kelas Font Awesome 6.
 * - `custom`: hanya `icons.custom`, sisanya SVG bawaan.
 * `icons.custom` selalu diprioritaskan. Nama di luar set bawaan pada set SVG
 * dirender sebagai ikon font Material.
 */
import { computed } from 'vue';
import { useMrcatz } from '../config';
import { fontAwesomeClass, iconPaths, isBuiltinIcon, isSvgChildren, materialName, type IconName } from '../icons';

const props = withDefaults(defineProps<{ name: IconName; size?: number | string }>(), { size: 20 });
const { icons } = useMrcatz();

const fontSize = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size));
const fontStyle = computed(() => ({ fontSize: fontSize.value, width: fontSize.value, height: fontSize.value }));

type Render =
  | { kind: 'svg'; html: string }
  | { kind: 'html'; html: string }
  | { kind: 'component'; comp: object }
  | { kind: 'material'; text: string }
  | { kind: 'fa'; cls: string };

const render = computed<Render>(() => {
  const name = props.name;
  // HTML/SVG langsung sebagai nama (mis. `icon: '<i class="bi bi-star"></i>'`).
  const custom = name.trimStart().startsWith('<') ? name : icons.custom[name];
  if (custom) {
    if (typeof custom !== 'string') return { kind: 'component', comp: custom };
    return isSvgChildren(custom) ? { kind: 'svg', html: custom } : { kind: 'html', html: custom };
  }
  if (icons.set === 'material') return { kind: 'material', text: materialName(name) };
  if (icons.set === 'fontawesome') return { kind: 'fa', cls: fontAwesomeClass(name) };
  if (isBuiltinIcon(name)) return { kind: 'svg', html: iconPaths[name] };
  return { kind: 'material', text: name };
});
</script>

<template>
  <svg
    v-if="render.kind === 'svg'"
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    aria-hidden="true"
    class="inline-block shrink-0"
    v-html="render.html"
  />
  <component :is="render.comp" v-else-if="render.kind === 'component'" :size="size" class="inline-block shrink-0" aria-hidden="true" />
  <span
    v-else-if="render.kind === 'material'"
    :class="icons.materialClass"
    class="inline-flex shrink-0 items-center justify-center leading-none select-none"
    :style="fontStyle"
    aria-hidden="true"
    >{{ render.text }}</span
  >
  <i
    v-else-if="render.kind === 'fa'"
    :class="render.cls"
    class="inline-flex shrink-0 items-center justify-center leading-none"
    :style="fontStyle"
    aria-hidden="true"
  />
  <span
    v-else
    class="inline-flex shrink-0 items-center justify-center leading-none [&>svg]:size-full"
    :style="fontStyle"
    aria-hidden="true"
    v-html="render.html"
  />
</template>
