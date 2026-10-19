<script setup lang="ts">
/**
 * Pemilih lokasi — port `partials/form/map-picker.blade.php`. Klik peta /
 * geser marker, "Gunakan lokasi saya", reset ke titik awal, panel input
 * manual (debounce 400 ms), dan slider radius + lingkaran.
 *
 * Penyedia:
 * - `leaflet` (default): OpenStreetMap, paket `leaflet` (peer opsional) dimuat lewat `import()`.
 *   Tile gelap CARTO dipakai saat `data-theme` gelap atau `theme: 'dark'`.
 * - `google`: Google Maps JS SDK dimuat dari googleapis dengan `apiKey`.
 *
 * Nilai: `{ lat, lng }` (+ `radius` bila opsi `radius` aktif). Sama dengan
 * Laravel, nilai kosong langsung diisi titik awal saat peta siap.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useMrcatz } from '../../../config';
import { mapRadius, type FieldDef, type LatLngValue } from '../../../fields';
import MrcIcon from '../../MrcIcon.vue';
import { cssSize, injectStyle, isDarkTheme } from '../registry';

const props = defineProps<{ field: FieldDef; modelValue?: LatLngValue | null; disabled?: boolean; invalid?: boolean }>();
const emit = defineEmits<{ 'update:modelValue': [value: LatLngValue] }>();
const { t } = useMrcatz();

const CSS = `
.mrcatz-map-wrap { border-radius: var(--radius-field, 0.5rem); border: 1px solid color-mix(in oklab, var(--color-base-content) 20%, transparent); background-color: var(--color-base-100); overflow: hidden; transition: border-color 150ms ease; }
.mrcatz-map-wrap.mrcatz-map-error { border-color: var(--color-error, #ef4444); }
.mrcatz-map-controls { padding: 0.625rem 0.75rem 0.75rem; }
.mrcatz-map-container { position: relative; isolation: isolate; z-index: 0; overflow: hidden; border-bottom: 1px solid color-mix(in oklab, var(--color-base-content) 15%, transparent); }
.mrcatz-map-container .mrcatz-map { width: 100%; }
.mrcatz-map-coords { position: absolute; bottom: 8px; left: 8px; z-index: 400; background: rgba(255,255,255,0.92); backdrop-filter: blur(4px); padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #1f2937; box-shadow: 0 1px 3px rgba(0,0,0,0.15); pointer-events: none; }
[data-theme*="dark"] .mrcatz-map-coords { background: rgba(31,41,55,0.92); color: #e5e7eb; }
`;

const el = ref<HTMLElement>();
const expanded = ref(false);
const center = computed(() => props.field.center ?? { lat: -6.2088, lng: 106.8456 });
const radius = computed(() => mapRadius(props.field));
const current = computed(() => ({
  lat: num(props.modelValue?.lat) ?? center.value.lat,
  lng: num(props.modelValue?.lng) ?? center.value.lng,
  radius: num(props.modelValue?.radius) ?? radius.value?.default ?? null,
}));
const coordsLabel = computed(() => `${current.value.lat.toFixed(5)}, ${current.value.lng.toFixed(5)}`);

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------- penyedia peta
interface Adapter {
  setCenter(lat: number, lng: number): void;
  setRadius(r: number): void;
  destroy(): void;
}
let adapter: Adapter | null = null;
let disposed = false;

function push(lat: number, lng: number, r: number | null = current.value.radius) {
  emit('update:modelValue', radius.value ? { lat, lng, radius: r } : { lat, lng });
}
function pick(lat: number, lng: number) {
  adapter?.setCenter(lat, lng);
  push(lat, lng);
}

async function leaflet(lat: number, lng: number, r: number | null): Promise<Adapter> {
  const [mod] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css').catch(() => undefined)]);
  const L = ((mod as { default?: unknown }).default ?? mod) as typeof import('leaflet');
  const map = L.map(el.value!, { dragging: !props.disabled, zoomControl: !props.disabled }).setView([lat, lng], props.field.zoom ?? 13);
  const dark = props.field.theme ? props.field.theme === 'dark' : isDarkTheme();
  L.tileLayer(
    dark ? 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, attribution: '&copy; OpenStreetMap' + (dark ? ' &copy; CARTO' : '') },
  ).addTo(map);
  const marker = L.marker([lat, lng], { draggable: !props.disabled }).addTo(map);
  const circle = r !== null ? L.circle([lat, lng], { radius: r, color: 'var(--color-primary, #2563eb)', fillOpacity: 0.15 }).addTo(map) : null;
  if (!props.disabled) {
    map.on('click', (e: { latlng: { lat: number; lng: number } }) => pick(e.latlng.lat, e.latlng.lng));
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      pick(p.lat, p.lng);
    });
  }
  return {
    setCenter(a, b) {
      marker.setLatLng([a, b]);
      circle?.setLatLng([a, b]);
      map.panTo([a, b]);
    },
    setRadius: (v) => circle?.setRadius(v),
    destroy: () => map.remove(),
  };
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-mrcatz-src="${src}"]`);
    if (existing?.dataset.mrcatzLoaded) return resolve();
    const s = existing ?? document.createElement('script');
    s.addEventListener('load', () => ((s.dataset.mrcatzLoaded = '1'), resolve()), { once: true });
    s.addEventListener('error', () => reject(new Error(`Gagal memuat ${src}`)), { once: true });
    if (!existing) {
      s.src = src;
      s.async = true;
      s.dataset.mrcatzSrc = src;
      document.head.appendChild(s);
    }
  });
}

async function google(lat: number, lng: number, r: number | null): Promise<Adapter> {
  const w = window as unknown as { google?: { maps?: any } };
  if (!w.google?.maps) await loadScript(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(props.field.apiKey ?? '')}&v=weekly`);
  const g = w.google!.maps;
  const map = new g.Map(el.value, { center: { lat, lng }, zoom: props.field.zoom ?? 13, draggable: !props.disabled, clickableIcons: false });
  const marker = new g.Marker({ position: { lat, lng }, map, draggable: !props.disabled });
  const circle =
    r !== null ? new g.Circle({ map, center: { lat, lng }, radius: r, strokeColor: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.15 }) : null;
  if (!props.disabled) {
    map.addListener('click', (e: any) => pick(e.latLng.lat(), e.latLng.lng()));
    marker.addListener('dragend', (e: any) => pick(e.latLng.lat(), e.latLng.lng()));
  }
  return {
    setCenter(a, b) {
      marker.setPosition({ lat: a, lng: b });
      circle?.setCenter({ lat: a, lng: b });
      map.panTo({ lat: a, lng: b });
    },
    setRadius: (v) => circle?.setRadius(v),
    destroy: () => g.event?.clearInstanceListeners?.(map),
  };
}

const failed = ref(false);
onMounted(async () => {
  injectStyle('mrcatz-map-style', CSS);
  const { lat, lng, radius: r } = current.value;
  try {
    const a = await (props.field.provider === 'google' ? google(lat, lng, r) : leaflet(lat, lng, r));
    if (disposed) return a.destroy();
    adapter = a;
  } catch (e) {
    failed.value = true;
    console.warn(`[mrcatz] field.map(): gagal memuat peta (${props.field.provider ?? 'leaflet'}). Untuk Leaflet: bun add leaflet`, e);
  }
  // Seperti Laravel: isi nilai kosong dengan titik awal agar form langsung valid.
  if (num(props.modelValue?.lat) === null || num(props.modelValue?.lng) === null) push(lat, lng, r);
});
onBeforeUnmount(() => {
  disposed = true;
  adapter?.destroy();
});

// Nilai berubah dari luar (input manual, reset form) → pindahkan marker/lingkaran.
watch(
  () => [props.modelValue?.lat, props.modelValue?.lng, props.modelValue?.radius],
  () => {
    const lat = num(props.modelValue?.lat);
    const lng = num(props.modelValue?.lng);
    if (lat !== null && lng !== null) adapter?.setCenter(lat, lng);
    const r = num(props.modelValue?.radius);
    if (r !== null) adapter?.setRadius(r);
  },
);

function locate() {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition((pos) => pick(pos.coords.latitude, pos.coords.longitude));
}
function clear() {
  pick(center.value.lat, center.value.lng);
}

// Input manual: debounce 400 ms (pengganti `wire:model.live.debounce.400ms`).
let timer: ReturnType<typeof setTimeout> | undefined;
function manual(key: 'lat' | 'lng' | 'radius', raw: string) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const next: LatLngValue = { lat: current.value.lat, lng: current.value.lng };
    if (radius.value) next.radius = current.value.radius;
    next[key] = raw === '' ? null : Number(raw);
    emit('update:modelValue', next);
  }, 400);
}
function clampRadius(e: Event) {
  const r = radius.value!;
  const input = e.target as HTMLInputElement;
  const v = Number(input.value);
  const clamped = Math.min(r.max, Math.max(r.min, Number.isNaN(v) ? r.default : v));
  if (v !== clamped) {
    clearTimeout(timer);
    input.value = String(clamped);
    setRadius(clamped);
  }
}
function setRadius(v: number) {
  adapter?.setRadius(v);
  emit('update:modelValue', { lat: current.value.lat, lng: current.value.lng, radius: v });
}
</script>

<template>
  <div class="mrcatz-map-wrap" :class="invalid && 'mrcatz-map-error'">
    <div class="mrcatz-map-container">
      <div ref="el" class="mrcatz-map" :style="{ height: cssSize(field.height, '320px') }" />
      <div class="mrcatz-map-coords">{{ coordsLabel }}</div>
      <p v-if="failed" class="text-error absolute inset-x-0 top-2 text-center text-xs">{{ t('map.loadFailed') }}</p>
    </div>

    <div class="mrcatz-map-controls">
      <template v-if="!disabled">
        <div class="flex flex-wrap items-center justify-between gap-1 gap-y-2">
          <div class="flex flex-wrap items-center gap-1">
            <button type="button" class="btn btn-ghost btn-xs gap-1 px-2" data-part="locate" @click="locate">
              <MrcIcon name="pin" :size="16" />
              <span class="hidden sm:inline">{{ t('map.useMyLocation') }}</span>
            </button>
            <button type="button" class="btn btn-ghost btn-xs text-base-content/60 gap-1 px-2" data-part="clear" @click="clear">
              <MrcIcon name="close" :size="16" />
              <span class="hidden sm:inline">{{ t('map.clear') }}</span>
            </button>
          </div>
          <button type="button" class="btn btn-ghost btn-xs text-base-content/60 gap-1 px-2" :aria-expanded="expanded" data-part="toggle" @click="expanded = !expanded">
            <span class="hidden sm:inline">{{ expanded ? t('map.hideInputs') : t('map.showInputs') }}</span>
            <span class="inline-flex shrink-0 items-center transition-transform duration-200" :class="expanded && 'rotate-180'">
              <MrcIcon name="expand_more" :size="16" />
            </span>
          </button>
        </div>

        <div v-show="expanded">
          <div class="mt-2 grid gap-2" :class="radius ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'">
            <label class="flex flex-col gap-1">
              <span class="text-base-content/60 text-[10px] font-semibold tracking-wide uppercase">{{ t('map.latitude') }}</span>
              <input
                type="number"
                step="0.000001"
                min="-90"
                max="90"
                inputmode="decimal"
                class="input input-bordered input-sm w-full text-sm tabular-nums"
                placeholder="-6.208800"
                data-part="lat"
                :value="modelValue?.lat ?? ''"
                @input="manual('lat', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-base-content/60 text-[10px] font-semibold tracking-wide uppercase">{{ t('map.longitude') }}</span>
              <input
                type="number"
                step="0.000001"
                min="-180"
                max="180"
                inputmode="decimal"
                class="input input-bordered input-sm w-full text-sm tabular-nums"
                placeholder="106.845600"
                data-part="lng"
                :value="modelValue?.lng ?? ''"
                @input="manual('lng', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label v-if="radius" class="flex flex-col gap-1">
              <span class="text-base-content/60 text-[10px] font-semibold tracking-wide uppercase">{{ t('map.radiusMeters') }}</span>
              <input
                type="number"
                step="1"
                :min="radius.min"
                :max="radius.max"
                inputmode="numeric"
                class="input input-bordered input-sm w-full text-sm tabular-nums"
                :placeholder="String(radius.default)"
                :value="modelValue?.radius ?? ''"
                @input="manual('radius', ($event.target as HTMLInputElement).value)"
                @change="clampRadius"
              />
            </label>
          </div>
        </div>
      </template>

      <fieldset v-if="radius" class="fieldset mt-3">
        <legend class="fieldset-legend text-base-content/70 text-xs font-semibold tracking-wide uppercase">{{ t('map.radius') }}</legend>
        <input
          type="range"
          class="range range-primary w-full"
          :class="disabled && 'opacity-60'"
          :min="radius.min"
          :max="radius.max"
          step="1"
          :value="current.radius ?? radius.default"
          :disabled="disabled"
          data-part="radius"
          @input="setRadius(Number(($event.target as HTMLInputElement).value))"
        />
        <div class="text-base-content/50 flex justify-between px-1 text-xs">
          <span>{{ radius.min }} m</span>
          <span v-show="!expanded" class="tabular-nums">{{ current.radius ?? radius.default }} m</span>
          <span>{{ radius.max }} m</span>
        </div>
      </fieldset>
    </div>
  </div>
</template>
