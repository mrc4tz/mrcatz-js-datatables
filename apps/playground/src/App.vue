<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import {
  MrcCrudTable,
  MrcDataTable,
  MrcToaster,
  bulkAction,
  col,
  field,
  filter,
  memorySource,
  type BulkAction,
  type DataSource,
  type FormValues,
} from '@mrc4tz/datatable-vue';
import { KATEGORI, KECAMATAN, STATUS, makeLaporan, type Laporan } from './data';

// ---------------------------------------------------------------- "database" in-memory
const rows = ref<Laporan[]>(makeLaporan());
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Bungkus sumber memori dengan latensi buatan agar state loading terlihat. */
function withLatency<T>(src: DataSource<T>, ms = 250): DataSource<T> {
  return {
    ...src,
    fetch: async (q, s) => (await sleep(ms), src.fetch(q, s)),
    schema: src.schema && (async (q, s) => (await sleep(ms / 2), src.schema!(q, s))),
  };
}

const source = withLatency(
  memorySource(rows, {
    key: 'laporan',
    search: { columns: [{ field: 'judul', weight: 3 }, 'nomor', 'pelapor', 'kategori.nama'], typoTolerance: true },
    defaultSort: [{ key: 'createdAt', dir: 'desc' }],
    utcOffset: '+08:00',
    filters: [
      filter.multi('status', 'Status', { field: 'status', options: STATUS, allowExclude: true }),
      filter.select('kecamatan', 'Kecamatan', { field: 'kecamatan', options: KECAMATAN }),
      filter.select('kategori', 'Kategori', {
        field: 'kategoriId',
        // Opsi dinamis + filter bertingkat: hanya muncul setelah kecamatan dipilih.
        options: async () => (await sleep(150), KATEGORI.map((k) => ({ value: k.id, label: k.nama }))),
        dependsOn: 'kecamatan',
        visible: (ctx) => !!ctx.values.kecamatan,
      }),
      filter.select('prioritas', 'Prioritas ≥', {
        field: 'prioritas',
        operator: '>=',
        options: [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n}` })),
      }),
      filter.dateRange('dibuat', 'Tanggal Laporan', { field: 'createdAt' }),
      filter.date('bulan', 'Bulan', { field: 'createdAt', format: 'month' }),
    ],
  }),
);

const columns = [
  col.rowNumber(),
  col.image('foto', 'Foto', { fallbackKey: 'pelapor', width: 36, height: 36 }),
  col.text('nomor', 'Nomor', { rowHeader: true, width: 140 }),
  col.text('judul', 'Judul', { editable: { validate: (v) => (v.trim().length < 5 ? 'Judul minimal 5 karakter' : undefined) } }),
  col.text('pelapor', 'Pelapor'),
  col.text('email', 'Email', { hidden: true }),
  col.text('kecamatan', 'Kecamatan', { showOn: 'desktop' }),
  col.text('kategori.nama', 'Kategori', { sortKey: 'kategori.nama' }),
  col.badge('status', 'Status', { baru: 'info', diproses: 'warning', selesai: 'success', ditolak: 'error' }, {
    format: (v) => STATUS.find((s) => s.value === v)?.label ?? String(v),
  }),
  col.number('prioritas', 'Prioritas', {
    editable: { input: 'select', options: [1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) })) },
  }),
  col.date('createdAt', 'Dilaporkan', { intl: { dateStyle: 'medium' } }),
  col.actions<Laporan>({
    delete: (row) => row.status !== 'selesai',
    extra: [{ id: 'lihat', label: 'Detail', icon: 'eye', onClick: (r) => alert(`Laporan ${r.nomor}: ${r.judul}`) }],
  }),
];

const fields = [
  field.section('Informasi Laporan'),
  field.text('judul', 'Judul', { required: true, minLength: 5, placeholder: 'Ringkasan keluhan' }),
  field.text('pelapor', 'Nama Pelapor', { required: true, span: 6 }),
  field.email('email', 'Email', { required: true, span: 6 }),
  field.select('kecamatan', 'Kecamatan', { options: KECAMATAN, required: true, span: 6 }),
  field.select('kategoriId', 'Kategori', { options: KATEGORI.map((k) => ({ value: k.id, label: k.nama })), required: true, span: 6 }),
  field.radio('status', 'Status', { options: STATUS, defaultValue: 'baru' }),
  field.range('prioritas', 'Prioritas', { min: 1, max: 5, defaultValue: 3 }),
  field.textarea('alasan', 'Alasan Penolakan', { visibleWhen: { status: 'ditolak' }, required: true, hint: 'Wajib saat status Ditolak' }),
];

const bulkActions: BulkAction<Laporan>[] = [
  bulkAction('selesaikan', 'Tandai Selesai', { mode: 'confirm', icon: 'check', tone: 'success', description: 'Status laporan terpilih menjadi Selesai.' }),
  bulkAction('ubahStatus', 'Ubah Status', { fields: [field.select('status', 'Status baru', { options: STATUS, required: true })] }),
];

// ---------------------------------------------------------------- handler CRUD
let nextId = rows.value.length + 1;
function toRow(v: FormValues, base?: Laporan): Laporan {
  const kat = KATEGORI.find((k) => k.id === Number(v.kategoriId))!;
  return {
    ...(base ?? { id: nextId, nomor: `HT-2026-${String(nextId++).padStart(4, '0')}`, createdAt: new Date().toISOString(), foto: null }),
    judul: v.judul, pelapor: v.pelapor, email: v.email, kecamatan: v.kecamatan,
    kategoriId: kat.id, kategori: kat, status: v.status, prioritas: Number(v.prioritas),
  } as Laporan;
}
async function create(v: FormValues) {
  await sleep(400);
  rows.value = [toRow(v), ...rows.value];
}
async function update(row: Laporan, v: FormValues) {
  await sleep(400);
  rows.value = rows.value.map((r) => (r.id === row.id ? toRow(v, row) : r));
}
async function remove(row: Laporan) {
  await sleep(300);
  rows.value = rows.value.filter((r) => r.id !== row.id);
}
async function removeMany(list: Laporan[]) {
  await sleep(300);
  const ids = new Set(list.map((r) => r.id));
  rows.value = rows.value.filter((r) => !ids.has(r.id));
}
async function cellUpdate(row: Laporan, key: string, value: string) {
  await sleep(300);
  rows.value = rows.value.map((r) => (r.id === row.id ? { ...r, [key]: key === 'prioritas' ? Number(value) : value } : r));
}
async function onBulkAction(action: BulkAction<Laporan>, list: Laporan[], values: FormValues) {
  await sleep(300);
  const status = action.id === 'selesaikan' ? 'selesai' : values.status;
  const ids = new Set(list.map((r) => r.id));
  rows.value = rows.value.map((r) => (ids.has(r.id) ? { ...r, status } : r));
}

// ---------------------------------------------------------------- tabel kedua (load more)
const kategoriRows = computed(() =>
  KATEGORI.flatMap((k) =>
    KECAMATAN.map((kec, i) => ({ id: `${k.id}-${i}`, kategori: k.nama, kecamatan: kec.label, jumlah: rows.value.filter((r) => r.kategoriId === k.id && r.kecamatan === kec.value).length })),
  ),
);
const rekapSource = memorySource(kategoriRows, { key: 'rekap', search: { columns: ['kategori', 'kecamatan'] } });
const rekapColumns = [col.text('kategori', 'Kategori'), col.text('kecamatan', 'Kecamatan'), col.number('jumlah', 'Jumlah Laporan')];

const dark = ref(false);
watchEffect(() => document.documentElement.setAttribute('data-theme', dark.value ? 'dark' : 'light'));
</script>

<template>
  <main class="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold">MrCatz DataTable · JS</h1>
        <p class="text-base-content/60 text-sm">Playground — Vue 3 + Tailwind v4 + daisyUI 5, data in-memory</p>
      </div>
      <label class="flex cursor-pointer items-center gap-2 text-sm">
        Gelap <input v-model="dark" type="checkbox" class="toggle toggle-sm" />
      </label>
    </div>

    <MrcCrudTable
      name="laporan"
      entity="Laporan"
      title="Laporan Pengaduan"
      description="Klik dua kali judul/prioritas untuk edit langsung. Shift+klik header untuk multi-sort."
      :source="source"
      :columns="columns"
      :fields="fields"
      :create="create"
      :update="update"
      :remove="remove"
      :remove-many="removeMany"
      :bulk-actions="bulkActions"
      :on-bulk-action="onBulkAction"
      :on-cell-update="cellUpdate"
      :selectable="(r: Laporan) => r.status !== 'selesai'"
      :delete-label="(r: Laporan) => `${r.nomor} — ${r.judul}`"
      :expand-fields="[
        { label: 'Email', key: 'email' },
        { label: 'Kecamatan', key: 'kecamatan' },
        { label: 'Foto', key: 'foto', type: 'image' },
        { label: 'Lampiran', type: 'link', linkLabel: 'Unduh', icon: 'download', href: (r: Laporan) => `#lampiran-${r.id}` },
      ]"
      expandable
      show-keyboard-hint
      :per-page-options="[10, 25, 50]"
    />

    <MrcDataTable
      name="rekap"
      title="Rekap per Kategori & Kecamatan"
      :source="rekapSource"
      :columns="rekapColumns"
      pagination="load-more"
      :per-page-options="[8]"
      :exportable="{ formats: ['csv'] }"
      :presets="false"
      :column-reorder="false"
    />
  </main>
  <MrcToaster />
</template>
