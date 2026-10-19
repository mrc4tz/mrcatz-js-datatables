<script setup lang="ts">
/**
 * Panel melayang ringan (dropdown filter, combobox, menu kolom).
 *
 * Panel di-teleport ke `<dialog>` terdekat (agar tetap di top-layer modal)
 * atau ke `body`, lalu diposisikan `fixed` dari koordinat pemicu — sehingga
 * tidak terpotong oleh container ber-`overflow` (tabel, isi modal). Otomatis
 * membuka ke atas bila ruang di bawah tidak cukup. Tutup dengan klik di luar
 * atau Escape.
 */
import { nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    align?: 'start' | 'end';
    /** Lebar panel (CSS). `'trigger'` = selebar pemicu. */
    width?: string;
    disabled?: boolean;
    /** Matikan teleport bila perlu tetap di dalam DOM induk. Default true. */
    teleport?: boolean;
  }>(),
  { align: 'start', width: '18rem', teleport: true },
);
const open = defineModel<boolean>('open', { default: false });
const root = ref<HTMLElement>();
const panel = ref<HTMLElement>();
const target = ref<HTMLElement | string>('body');
const style = reactive<Record<string, string>>({});

const GAP = 6;
const MIN_BELOW = 280;

function place() {
  const el = root.value;
  if (!el || !props.teleport) return;
  const r = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const below = vh - r.bottom;
  const up = below < MIN_BELOW && r.top > below;

  for (const k of Object.keys(style)) delete style[k];
  style.position = 'fixed';
  style.width = props.width === 'trigger' ? `${r.width}px` : props.width;
  style.maxHeight = `${Math.max(160, (up ? r.top : below) - GAP * 2)}px`;
  if (up) style.bottom = `${vh - r.top + GAP}px`;
  else style.top = `${r.bottom + GAP}px`;
  if (props.align === 'end') style.right = `${Math.max(8, vw - r.right)}px`;
  else style.left = `${Math.max(8, Math.min(r.left, vw - 8 - (panel.value?.offsetWidth ?? 0)))}px`;
}

function onDocClick(e: MouseEvent) {
  const t = e.target as Node;
  if (root.value?.contains(t) || panel.value?.contains(t)) return;
  open.value = false;
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    // Jangan ikut menutup modal induk.
    e.stopPropagation();
    e.preventDefault();
    open.value = false;
  }
}
function listen(on: boolean) {
  if (typeof document === 'undefined') return;
  if (on) {
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
  } else {
    document.removeEventListener('mousedown', onDocClick);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, true);
  }
}

watch(open, async (v) => {
  if (v) {
    target.value = (root.value?.closest('dialog') as HTMLElement | null) ?? 'body';
    place();
    await nextTick();
    place(); // ulangi setelah lebar panel diketahui
    setTimeout(() => listen(true));
  } else listen(false);
});
onBeforeUnmount(() => listen(false));

function toggle() {
  if (!props.disabled) open.value = !open.value;
}
</script>

<template>
  <div ref="root" class="relative inline-block">
    <slot name="trigger" :open="open" :toggle="toggle" />
    <Teleport :to="target" :disabled="!teleport">
      <Transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="opacity-0 -translate-y-1"
        leave-active-class="transition duration-75 ease-in"
        leave-to-class="opacity-0"
      >
        <div
          v-if="open"
          ref="panel"
          class="mrc-popover bg-base-100 border-base-content/10 text-base-content z-[60] flex max-w-[calc(100vw-1rem)] flex-col overflow-y-auto rounded-box border p-2 text-sm shadow-lg"
          :class="!teleport && ['absolute top-full mt-1.5', align === 'end' ? 'right-0' : 'left-0']"
          :style="teleport ? style : { width: width === 'trigger' ? '100%' : width }"
          role="dialog"
        >
          <slot :close="() => (open = false)" />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
