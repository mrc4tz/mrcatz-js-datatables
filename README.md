# MrCatz DataTable · JS

Versi JavaScript dari [`mrcatz/datatable`](https://github.com/mrc4tz/mrcatz-datatables) (Laravel Livewire) —
DataTable + Form Builder + CRUD untuk stack **NestJS + Prisma** di server dan **Vue 3 / Nuxt 4 + Tailwind v4 + daisyUI 5 + TanStack Query** di client.

| Paket | Isi |
|---|---|
| [`@mrcatz/datatable-core`](packages/core) | Protokol query (URL ⇄ objek), definisi filter, pencarian + highlight, engine in-memory, CSV. Tanpa dependensi. |
| [`@mrcatz/datatable-server`](packages/server) | `defineDataTable()` untuk Prisma: filter → `where`, pencarian, multi-sort aman (whitelist), relevansi PostgreSQL, export, integrasi NestJS. |
| [`@mrcatz/datatable-vue`](packages/vue) | `<MrcDataTable>`, `<MrcCrudTable>`, `<MrcForm>`, filter, inline edit, aksi massal, baris expand, kartu mobile, export CSV/PDF. |

## Fitur

- Pencarian multi-kata dengan **highlight** (aman XSS), bobot per kolom, **toleransi salah ketik** (trigram / `pg_trgm`), peringkat **relevansi** (termasuk kolom join), driver **Meilisearch** dengan filter pushdown
- Filter **select**, **multi** (Termasuk/Kecuali), **tanggal** (hari/bulan/tahun/datetime/jam + operator, batas dinamis), **rentang tanggal** (dengan preset), filter **bertingkat** (`dependsOn`), **preset filter** tersimpan
- **Multi-sort** (Shift+klik), sembunyikan/urutkan/ubah lebar kolom
- State tabel tersinkron ke **URL** (bisa dibagikan/di-bookmark), namespace per tabel
- **Inline edit** dengan validasi, **aksi massal** (konfirmasi / form), **baris expand**, **navigasi keyboard**
- Pagination bernomor atau **load more** (halaman digabung, tidak terpotong `maxLimit`), **kartu responsif** di mobile, skeleton / overlay layar penuh, empty state
- Generator CRUD **`npx mrcatz make Product`** (table + controller + module NestJS + halaman Nuxt)
- **Form Builder** 30+ tipe field (termasuk tombol aksi, foto/berkas dengan unggah/hapus, rentang tanggal, rating, chooser, editor Quill/TinyMCE, peta Leaflet/Google), section berbentuk kartu, kondisi tampil, opsi dinamis, validasi bawaan + [Standard Schema](https://standardschema.dev) (zod/valibot)
- **Form mandiri** di luar modal (`<MrcFormPage>`) & **breadcrumb** (`<MrcBreadcrumbs>`), ikon Material Symbols
- Export **CSV** (aman dari formula injection), **Excel** (.xlsx tanpa dependensi) & **PDF/cetak**, cakupan sesuai filter / semua / terpilih, warna & judul/subjudul bisa diatur, hook `transform` / `onExported`
- Pipeline **gambar editor** (`editorImages()`): unggah ke tmp, pindah ke permanen saat simpan, hapus yang tidak dipakai, bersihkan tmp
- i18n Bahasa Indonesia (default) & Inggris, notifikasi bisa diarahkan ke toast aplikasi

## Server — NestJS + Prisma

```bash
bun add @mrcatz/datatable-server
```

```ts
// pengguna.table.ts
import { defineDataTable, filter } from '@mrcatz/datatable-server';
import type { Prisma, User } from '@prisma/client';

export const penggunaTable = (prisma: PrismaService) =>
  defineDataTable<User, { instansiId: number }>({
    model: prisma.user,
    baseWhere: (ctx) => ({ instansiId: ctx.instansiId, deletedAt: null }), // pengganti baseQuery()
    select: { id: true, nama: true, email: true, role: true, createdAt: true, instansi: { select: { nama: true } } },
    search: {
      columns: [{ field: 'nama', weight: 3 }, 'email', 'instansi.nama'],
      typoTolerance: true,
    },
    filters: [
      filter.select<Prisma.UserWhereInput>('role', 'Peran', { field: 'role', options: ROLES }),
      filter.multi('instansi', 'Instansi', {
        field: 'instansiId',
        options: async () => (await prisma.instansi.findMany()).map((i) => ({ value: i.id, label: i.nama })),
        allowExclude: true,
      }),
      filter.dateRange('dibuat', 'Tanggal Daftar', { field: 'createdAt' }),
      filter.select<Prisma.UserWhereInput>('punyaLaporan', 'Punya Laporan', {
        options: [{ value: true, label: 'Ya' }, { value: false, label: 'Tidak' }],
        where: (v) => (v ? { laporan: { some: {} } } : { laporan: { none: {} } }), // pengganti createWithCallback
      }),
    ],
    sortable: ['nama', 'email', 'createdAt', 'instansi.nama'], // wajib diisi demi keamanan
    defaultSort: [{ key: 'createdAt', dir: 'desc' }],
    utcOffset: '+08:00', // WITA
  });
```

```ts
// pengguna.controller.ts
import { DataTableExceptionFilter, DataTableParams } from '@mrcatz/datatable-server/nest';
import type { RawQuery } from '@mrcatz/datatable-server';

@Controller('master/pengguna')
@UseFilters(DataTableExceptionFilter) // sort/tanggal tidak valid → 400, bukan 500
export class PenggunaController {
  private readonly table: ReturnType<typeof penggunaTable>;
  constructor(private prisma: PrismaService) {
    this.table = penggunaTable(prisma); // di constructor: aman untuk target ES2022+ (hindari TS2729)
  }

  @Get()
  list(@DataTableParams() q: RawQuery, @CurrentUser() user: User) {
    return this.table.query(q, { context: { instansiId: user.instansiId } }); // → { data, meta }
  }

  @Get('schema')
  schema(@DataTableParams() q: RawQuery) {
    return this.table.describe(q); // opsi filter dinamis + visibilitas
  }

  @Get('export')
  export(@DataTableParams() q: RawQuery, @CurrentUser() user: User) {
    return this.table.exportRows(q, { context: { instansiId: user.instansiId } });
  }
}
```

`meta` berbentuk `{ total, page, limit, totalPages, hasMore }` — sama dengan `PaginationMeta` di `shared-types`.

**Relevansi (PostgreSQL)** — urutkan hasil pencarian berdasarkan skor seperti versi Laravel:

```ts
search: {
  columns: [{ field: 'judul', weight: 3 }, { field: 'nomorTiket', column: 'nomor_tiket' }],
  typoTolerance: { driver: 'pg_trgm' }, // butuh CREATE EXTENSION pg_trgm
  relevance: { table: 'laporan', db: prisma },
},
```

Kolom relasi ikut diberi skor lewat `relevance.joins` (pengganti scoring `'customers.name' => 3` yang memakai
join dari `baseQuery()`). Identifier divalidasi dan `on` hanya boleh berupa kesetaraan `a.kolom = b.kolom`:

```ts
search: {
  columns: [{ field: 'nomor', weight: 2 }, { field: 'customer.nama', column: 'c.nama', weight: 3 }],
  relevance: {
    table: 'orders',
    db: prisma,
    joins: [{ table: 'customers', alias: 'c', on: 'c.id = orders.customer_id' }], // type: 'left' (default) | 'inner'
  },
},
```

> `typoTolerance: { driver: 'pg_trgm' }` tanpa `relevance` kini langsung melempar `DataTableConfigError`
> (sebelumnya diam-diam tanpa pencocokan fuzzy).

**Meilisearch (pengganti Scout)** — `search.driver` menerima mesin pencari eksternal yang mengembalikan id terurut
relevansi; engine lalu memfilter (`id in`), mengurutkan sesuai peringkat (atau sesuai sort pengguna) dan mem-paginate.
Paket `meilisearch` tidak ikut terpasang — teruskan client milik aplikasi:

```ts
import { MeiliSearch } from 'meilisearch';
import { meilisearchDriver, syncMeilisearchSettings } from '@mrcatz/datatable-server/meilisearch';

const meili = new MeiliSearch({ host: process.env.MEILI_HOST!, apiKey: process.env.MEILI_KEY });

export const produkTable = defineDataTable({
  model: prisma.produk,
  search: {
    columns: [{ field: 'nama', weight: 5 }, 'sku'],
    typoTolerance: true,
    driver: meilisearchDriver({
      client: meili,
      index: 'produk',
      maxResults: 1000,                        // scout_max_results
      filterPushdown: 'auto',                  // 'auto' | 'always' | 'never'
      dateFields: { createdAt: 'createdAtTs' }, // date_field_map — atribut berisi unix detik
      castId: Number,                          // bila id di Meilisearch berupa string
    }),
  },
  filters: [/* select/multi/date/dateRange dengan `field` otomatis dikirim ke Meilisearch */],
  sortable: ['nama', 'createdAt'],
});

// pengganti `php artisan mrcatz:meilisearch:configure` (searchable/filterable/sortable/typoTolerance)
await syncMeilisearchSettings(produkTable); // atau (produkTable, meili, 'produk', { dryRun: true })
```

Filter `select`, `multi` (termasuk Kecuali) dan `date`/`dateRange` (lewat `dateFields`) yang memakai `field` diterjemahkan
ke ekspresi filter Meilisearch. Filter dengan `where`, operator `contains`, atau format jam tetap diterapkan di SQL
(`auto`, callback `onFallback` dipanggil) atau ditolak saat definisi (`always`). Driver lain cukup memenuhi kontrak
`SearchDriver` (`search(req) → { ids, pushedFilters? }`).

**Filter jam & batas dinamis**

```ts
// Format jam: 'time' (HH:mm:ss) / 'timeHm' (HH:mm). Prisma tidak bisa mengambil jam dari kolom tanggal
// secara portabel, jadi di server wajib `where` (memorySource mendukung `field` langsung).
filter.date('jamBuka', 'Jam Buka', {
  format: 'timeHm',
  where: (v) => ({ jamBuka: compareBounds(periodOf(v, 'timeHm'), '>=') }), // kolom @db.Time
  // kolom detik: where: (v) => ({ detikBuka: { gte: parseTimeOfDay(v) } })
}),

// min / max / operator boleh fungsi dari nilai filter lain (pengganti setFilterDateBounds()).
filter.date('rilis', 'Tanggal Rilis', {
  field: 'releasedAt',
  dependsOn: 'tahun',
  min: (ctx) => (ctx.values.tahun ? `${ctx.values.tahun}-01-01` : undefined),
  max: (ctx) => (ctx.values.tahun ? `${ctx.values.tahun}-12-31` : undefined),
  operator: (ctx) => (ctx.values.arah === 'sebelum' ? '<' : '>='),
}),
```

## Client — Nuxt 4 / Vue 3

```bash
bun add @mrcatz/datatable-vue @tanstack/vue-query
bun add -d daisyui
```

```css
/* app/assets/css/main.css */
@import 'tailwindcss';
@plugin 'daisyui';
@source '../../../node_modules/@mrcatz/datatable-vue/dist'; /* wajib: agar kelas komponen ter-generate */
```

```ts
// app/plugins/mrcatz.ts
import { createMrcatz } from '@mrcatz/datatable-vue';
import { toast } from 'vue-sonner';

export default defineNuxtPlugin((nuxt) => {
  nuxt.vueApp.use(createMrcatz({ locale: 'id', notify: (type, msg) => toast[type](msg) }));
});
```

```vue
<!-- app/pages/master/pengguna.vue -->
<script setup lang="ts">
import { col, field, httpSource } from '@mrcatz/datatable-vue';

const api = useApi();
const source = httpSource<User>({
  url: '/master/pengguna',
  schemaUrl: '/master/pengguna/schema',
  exportUrl: '/master/pengguna/export',
  fetcher: (url, { query, signal }) => api(url, { query, signal }),
});

const columns = [
  col.rowNumber(),
  col.text('nama', 'Nama', { rowHeader: true }),
  col.text('email', 'Email'),
  col.badge('role', 'Peran', { admin: 'primary', petugas: 'info', warga: 'ghost' }),
  col.text('instansi.nama', 'Instansi'),
  col.date('createdAt', 'Terdaftar'),
  col.actions({ delete: (u) => u.role !== 'admin' }),
];

const fields = [
  field.text('nama', 'Nama', { required: true, span: 6 }),
  field.email('email', 'Email', { required: true, span: 6 }),
  field.select('role', 'Peran', { options: ROLES, required: true }),
  field.password('password', 'Password', { required: (v) => !v.id, confirm: true, minLength: 8 }),
];
</script>

<template>
  <MrcCrudTable
    name="pengguna" entity="Pengguna" title="Pengguna"
    :source="source" :columns="columns" :fields="fields"
    :create="(v) => api('/master/pengguna', { method: 'POST', body: v })"
    :update="(row, v) => api(`/master/pengguna/${row.id}`, { method: 'PATCH', body: v })"
    :remove="(row) => api(`/master/pengguna/${row.id}`, { method: 'DELETE' })"
    :remove-many="(rows) => api('/master/pengguna/bulk-delete', { method: 'POST', body: { ids: rows.map((r) => r.id) } })"
    :delete-label="(u) => u.nama"
  >
    <template #cell-nama="{ row, search }">
      <MrcHighlight :text="row.nama" :search="search" />
    </template>
  </MrcCrudTable>
</template>
```

> **Catatan halotabalong.** `useApi()` membuka envelope `{ success, data }`. Bila responsnya sampai ke tabel tanpa `meta`,
> isi `transform` di `httpSource` agar mengembalikan `{ data, meta }`. daisyUI dan IDDS sama-sama memakai
> `data-theme="light|dark"`, jadi tema gelap ikut berpindah; warna daisyUI bisa diselaraskan dengan token `--ina-*`
> lewat `@plugin 'daisyui/theme'`.

### Ikon (pengganti `icon_set` di `config/mrcatz.php`)

Semua opsi ikon ada di `createMrcatz({ icons })` — tidak ada file config terpisah:

```ts
nuxt.vueApp.use(
  createMrcatz({
    icons: {
      // 'default' | 'heroicons' (SVG inline bawaan) | 'material' | 'fontawesome' | 'custom'
      set: 'material',
      materialClass: 'material-symbols-outlined', // atau 'material-icons'
      // gabungan `custom_icons` + `form_icons`; selalu diprioritaskan di set mana pun
      custom: {
        person: '<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 ..."/>', // dibungkus <svg> 24×24
        mail: '<i class="bi bi-envelope"></i>', // HTML apa adanya
        // star: StarIcon, // komponen Vue (mis. lucide-vue-next), menerima prop `size`
      },
    },
  }),
);
```

`material` dan `fontawesome` hanya mengganti markup — font/CSS-nya dimuat sendiri oleh aplikasi
(mis. Google Fonts *Material Symbols Outlined* atau CSS Font Awesome 6). `icon:` di field/aksi juga
boleh langsung berisi HTML (`icon: '<i class="bi bi-star"></i>'`).

Butuh kontrol penuh? `useDataTable()` mengembalikan seluruh state & aksi (query, seleksi, kolom, filter) tanpa UI.

### Form Builder — field lanjutan

```ts
const fields = [
  field.dateRange('periode', 'Periode', { format: 'date', min: '2020-01-01' }), // { from, to } + preset
  field.rating('skor', 'Rating', { max: 5 }),                                    // angka 1..max
  field.chooser('minat', 'Minat', { options: MINAT }),                           // array, tombol toggle
  field.select('peran', 'Peran', { options: ROLES, multiple: true }),            // array
  field.file('lampiran', 'Lampiran', { preview: row.lampiranUrl, maxSize: 2 * 1024 * 1024,
    onUpload: (file) => api.upload(file),            // URL kembalian menjadi nilai field
    onDelete: (ctx) => api.hapusLampiran(), deleteConfirm: 'Hapus lampiran?' }),
  field.fileUpload('foto', 'Foto Produk', { preview: row.foto, previewWidth: 120, previewHeight: 80 }),
  field.html('<p class="text-sm">Konten statis — tidak masuk payload</p>'),
  field.editor('ringkasan', 'Ringkasan', { upload: (file) => api.uploadGambar(file) }), // Quill
  field.editorAdvanced('isi', 'Isi Artikel'),                                             // TinyMCE 7
  field.map('lokasi', 'Lokasi Kantor', { center: { lat: -6.2088, lng: 106.8456 }, zoom: 13,
    radius: { default: 500, min: 10, max: 10000 } }),                    // { lat, lng, radius }
  field.text('kode', 'Kode', { tone: 'primary', size: 'sm', class: 'mt-4',
    onChange: cekKode, onChangeDebounce: 400,
    messages: { required: '{label} harus diisi', maxLength: 'Maksimal {max} huruf' }, maxLength: 8 }),
];
```

Editor & peta memakai paket **opsional** yang dimuat lewat `import()` hanya saat field tampil.
Pasang paketnya lalu impor entry-nya sekali (mis. di plugin Nuxt); tanpa itu field tampil sebagai
textarea HTML / input lat-lng biasa:

```bash
bun add quill     # field.editor()
bun add tinymce   # field.editorAdvanced() — skin/plugin dari CDN jsDelivr; self-host: editorOptions.base_url
bun add leaflet   # field.map() provider 'leaflet' (provider 'google' cukup apiKey)
```

```ts
import '@mrcatz/datatable-vue/editor';
import '@mrcatz/datatable-vue/editor-advanced';
import '@mrcatz/datatable-vue/map';
// atau renderer sendiri: registerFieldType('editor', MyTiptapEditor)
```

Gambar di editor: tanpa `upload` disisipkan sebagai base64 (sama dengan `editor_image.mode = base64`);
dengan `upload: (file) => Promise<url>` diunggah ke server Anda. `editorOptions` diteruskan ke Quill / `tinymce.init()`.

- `defaultValue` kini juga diterapkan `<MrcForm>` / `<MrcFormPage>` untuk nilai yang masih `undefined`.
- Validasi bawaan: `min`/`max` juga untuk `date`/`time`/`datetime`/`month`, `maxLength`, `maxSize` berkas,
  urutan & wajib kedua ujung `dateRange`, rentang lat/lng/radius `map`.
- Jarak grid: `<MrcForm gap="1rem" column-gap="1.5rem">` (`form-gap` / `form-column-gap` di `<MrcCrudTable>`, `gap` di `<MrcFormPage>`).
- `<MrcFormPage submit-tone="success">` mengganti warna tombol simpan.

**Error validasi dari server** — `withFormErrors()` mengubah respons 422 `{ errors: { field: pesan } }`,
`ValidationPipe` NestJS (`message: ['email must be an email']`), atau `ValidationError[]` menjadi `MrcFormError`:

```ts
import { withFormErrors } from '@mrcatz/datatable-vue';
const create = (v) => withFormErrors(() => api('/pengguna', { method: 'POST', body: v }), { fields });
```

**Form tulisan tangan di `<MrcCrudTable>`** (pengganti `@section('forms')`): modal, tombol Simpan,
validasi `schema`, toast, dan refresh tetap otomatis.

```vue
<MrcCrudTable entity="Pengguna" :source="source" :columns="columns" :schema="schema" :create="create">
  <template #form="{ values, errors, set, mode }">
    <input class="input" :value="values.nama" @input="set('nama', $event.target.value)" />
    <p v-if="errors.nama" class="text-error text-xs">{{ errors.nama }}</p>
  </template>
</MrcCrudTable>
```

## Generator CRUD (`npx mrcatz`)

Pengganti `php artisan mrcatz:make` — tersedia dari paket `@mrcatz/datatable-server`:

```bash
npx mrcatz make Product --path admin        # api: admin/product/product.{table,controller,module}.ts, web: pages/admin/products.vue
npx mrcatz make Product --api src --no-web  # hanya backend
npx mrcatz remove Product --path admin      # hapus file hasil make
```

Opsi: `--model`, `--table`, `--api` (default `apps/api/src`), `--web` (default `apps/web/app/pages`), `--prisma`
(default `prisma/prisma.service`), `--api-base` (default `/api`), `--force`.

## Gambar editor (`editorImages`)

Pengganti `editor_image` mode `upload` di `config/mrcatz.php`:

```ts
import { EditorImageError, editorImages, localDiskStorage } from '@mrcatz/datatable-server';

const images = editorImages({
  storage: localDiskStorage({ root: 'uploads', publicUrl: '/uploads' }), // atau adapter S3 sendiri
  path: 'editor-images',
  maxSize: 2048, // KB
  tmpLifetimeHours: 24,
});

@Post('editor-images')
@UseInterceptors(FileInterceptor('image'))
async upload(@UploadedFile() file: Express.Multer.File) {
  try {
    return await images.upload(file); // → { url }
  } catch (e) {
    if (e instanceof EditorImageError) throw new UnprocessableEntityException(e.message); // 422
    throw e;
  }
}

// saat simpan artikel:
data.body = await images.processHtml(dto.body, existing?.body);
```

Di client: `field.editor('body', 'Isi', { upload: async (file) => (await uploadImage(file)).url })`.

## Pemetaan nama: Laravel → JS

Penamaan dirapikan agar konsisten: **kata benda** untuk definisi (`col.*`, `field.*`, `filter.*`), **prop/opsi deskriptif** untuk perilaku,
dan **handler `on*`/event** untuk aksi pengguna.

### Tabel & kolom

| Laravel (`MrCatzDataTables` / `MrCatzDataTablesComponent`) | JS |
|---|---|
| `MrCatzDataTablesComponent` (kelas tabel) | `defineDataTable()` (server) + `<MrcDataTable>` (client) |
| `baseQuery()` | `baseWhere` |
| `configTable()` → `table_name`, `table_id` | `search.relevance.table`, `primaryKey` |
| `configTable()` → `scoring` | `search.columns[].weight` |
| `configTable()` → `typo_tolerance` | `search.typoTolerance` |
| `configTable()` → `scoring` kolom join (`customers.name`) | `search.relevance.joins` + `column: 'alias.kolom'` |
| `search.driver = 'scout'` + `scout_model` | `search.driver: meilisearchDriver({ client, index })` (`@mrcatz/datatable-server/meilisearch`) |
| `scout_max_results`, `filter_pushdown`, `date_field_map` | `maxResults`, `filterPushdown`, `dateFields` |
| `mrcatz:meilisearch:configure` | `syncMeilisearchSettings(table, client?, index?)` |
| `mrcatz:make-search-proxy` | tidak perlu — dokumen diindeks oleh aplikasi (id = primary key) |
| `setTable()` + `CreateMrCatzTable()` | prop `columns` |
| `withColumn($head, $key, ...)` | `col.text(key, label, opts)` (+ `col.number`, `col.date`, `col.badge`) |
| `withCustomColumn($head, fn)` | `col.custom(label, render)` atau slot `#cell-{id}` |
| `withColumnIndex('No')` | `col.rowNumber()` |
| `withActionColumn($head, $editable, $deletable)` | `col.actions({ edit, delete, extra })` |
| `withColumnImage(...)` | `col.image(key, label, opts)` |
| `uppercase`, `th`, `gravity` | `uppercase`, `rowHeader`, `align` |
| `visible: false` | `hidden: true` |
| `setDefaultOrder()` / `addOrderBy()` | `defaultSort` / `tiebreaker` |
| `getRowPerPageOption()` / `$p` | `perPageOptions` / `defaultPerPage` |
| `setPageName()` / `urlPrefix()` | `name` / `urlPrefix` (client), `prefix` (server) |
| `setSearchWord()` | `highlight()` / `<MrcHighlight>` |
| `enableBulk(fn)` | prop `selectable` |
| `$showBulkButton` / `toggleBulk()` / `$bulkActive` | prop `selection-toggle` / tombol "Pilih" / `v-model:selection-mode` |
| `enableEditable(fn)` | `col.text(..., { editable: { when } })` |
| `enableExpand(fn)` + `getExpandView()` | prop `expandable` + `expandFields` / slot `#expand`, per baris `expandWhen` |
| `getExpandView()` tipe `html` / `urlPrefix` / `target` | `ExpandField` `type: 'html' \| 'custom'`, `baseUrl`, `target` |
| `withColumn(..., editable:)` textarea / Tab | `editable: { input: 'textarea', saveOnBlur, parse }`, Tab = simpan & pindah sel |
| `$showSearch`, `$typeSearch`, `$typeSearchDelay` | `searchable`, `searchMode`, `searchDebounce` |
| `$showAddButton` | `creatable` (otomatis bila ada `@create`) |
| `$usePagination = false` + `$maxRows` | `pagination: 'load-more'` + `loadMoreChunk` |
| `$showLoadMoreButton` | `loadMoreButton` |
| `$withLoading` | `loadingOverlay: 'fullscreen'` |
| `$filterDebounceDelay` | `filterDebounce` (ms, default 300) |
| `onDataLoaded()` / `onFilterChanged()` | `@loaded(page)` / `@filter-change(id, value, filters)` |
| `$exportTitle`, `beforeExport()`, `afterExport()` | `:exportable="{ title, subtitle, filename, transform, onExported }"` |
| `config('mrcatz.export_colors')` | `createMrcatz({ export: { colors } })` / `exportable.colors` |
| `vendor:publish --tag=mrcatz-export` | `exportable.printTemplate` (layout PDF) + `buildExportTable`, `buildXlsx`, `downloadXlsx`, `printTable`, `escapeHtml` |
| `$cardContainer`, `$borderContainer` | `card`, `bordered` |
| `$tableZebraStyle`, `$stickyHeader` | `zebra`, `stickyHeader` |
| `$enableRowClick` / `onRowClick()` | `@row-click` |
| `$enableColumnVisibility` / `Reorder` / `Resize` / `Sorting` | `columnVisibility` / `columnReorder` / `columnResize` / `sorting` |
| `$enableKeyboardNav`, `$showKeyboardNavNote` | `keyboardNav`, `showKeyboardHint` |
| `$showCardOnMobile` | `mobileCards` |
| `refreshData()` / event `refreshDataTable` | `refresh()` |
| `resetData()` | `reset()` |
| `orderData()` / `addSort()` | `toggleSort(key, multi)` |
| `toggleColumn()` / `reorderColumn()` | `toggleColumn(id)` / `moveColumn(id, index)` |
| `emptyStateView()` | slot `#empty` |

### Filter

| Laravel (`MrCatzDataTableFilter`) | JS (`filter.*`) |
|---|---|
| `create($id, $label, $data, $value, $option, $key)` | `filter.select(id, label, { field, options })` |
| `createWithCallback(..., $callback)` | `filter.select(id, label, { options, where })` |
| `createCheck(...)` / `createCheckWithCallback` | `filter.multi(id, label, { field \| where, options })` |
| `->allowExclude()` | `allowExclude: true` |
| `->allowSearchWhen(5)` | `searchThreshold: 5` |
| `createDate(..., $format, $condition)` | `filter.date(id, label, { field, format, operator })` |
| `createDateRange(...)` | `filter.dateRange(id, label, { field, format })` |
| format `month_year` | format `month` |
| format `time` / `time_hm` | format `time` / `timeHm` (server: wajib `where`; helper `parseTimeOfDay`, `periodOf`) |
| `setFilterDateBounds($id, min, max, condition)` / `clearFilterOverride()` | `min`, `max`, `operator` berupa fungsi `(ctx) => ...` |
| kondisi `whereIn` / `whereNotIn` | mode Termasuk / Kecuali (`exclude`) |
| `setFilterShow()` / `onFilterChanged()` | `visible: (ctx) => ...` + `dependsOn` |
| `setFilterData()` | `options: (ctx) => ...` (dihitung ulang dari `dependsOn`) |
| `$data`, `$value`, `$option` | `options: [{ value, label }]` |

### Halaman CRUD & form

| Laravel (`MrCatzComponent` / `MrCatzFormField`) | JS |
|---|---|
| `MrCatzComponent` (halaman) | `<MrcCrudTable>` |
| `setForm()` | prop `fields` |
| `prepareAddData()` | `defaultValues` |
| `prepareEditData($data)` | `toFormValues(row)` |
| `prepareDeleteData()` + `$deleted_text` | `deleteLabel(row)` |
| `saveData()` (`$isEdit`) | `create(values)` / `update(row, values)` |
| `dropData()` | `remove(row)` |
| `dropBulkData($rows)` | `removeMany(rows)` |
| `onInlineUpdate()` | `@cell-update(row, key, value)` |
| `setBulkAction()` + `MrCatzBulkAction::create()` | `bulkActions` + `bulkAction(id, label, opts)` |
| `processBulkActionData()` | `@bulk-action(action, rows, values)` |
| `dispatch_to_view()` / `show_notif()` | otomatis (toast + refresh) / `notify`; aksi massal: `bulkAction({ notify })` |
| `setBulkForm()` berisi section Blade | `field.slot('x')` + slot `#bulk-field-{aksi}-x` |
| `$form_title` | `formTitle(mode, row)` |
| `$modalFullScreen` / `closeFormPage()` | `form-page` (form menggantikan tabel) / `closeForm()` |
| `$formPageCard` / `$formPageBorder` | `form-page-card` / `form-page-border` |
| `$deleteModalDismissOnClickOutside` | `delete-dismissible` |
| event `mrcatz-form-page-opened` / `-closed` | `@form-open(mode, row)` / `@form-close(mode)` |
| `php artisan mrcatz:make` / `mrcatz:remove` | `npx mrcatz make` / `npx mrcatz remove` |
| `processEditorImages()` + `EditorImageUploadController` + `mrcatz:cleanup-editor-images` | `editorImages({ storage }).processHtml()` / `.upload()` / `.cleanupTmp()` |
| `config('mrcatz.locale')` / per halaman | `createMrcatz({ locale })`, `useMrcatz().setLocale()`, `<MrcConfigProvider>` |
| `MrCatzFormField::text(...)` dst. | `field.text(name, label, opts)` dst. |
| `->span(6)`, `->hint()`, `->prefix()`, `->suffix()` | `span: 6`, `hint`, `prefix`, `suffix` |
| `->visibleWhen()` / `->visibleWhenAll()` / `->hideWhen()` | `visibleWhen: { field: value }` atau fungsi / `hidden` |
| `->dependsOn()` / `->onChange()` | `dependsOn: [...]` / `onChange(value, values)` |
| `->withConfirmation()` | `confirm: true` |
| `->withoutShowHide()` / `->withoutGenerate()` | `reveal: false` / `generate: false` |
| `MrCatzFormField::section()->asCard()` | `field.section(judul, { card: true })` |
| `MrCatzFormField::button(..., onClick:)->withLoading()` | `field.button(label, { icon, tone, onClick: async (ctx) => ... })` |
| `MrCatzFormField::image()->preview()->onUpload()->onDelete()` | `field.image(name, label, { preview, onUpload, onDelete, deleteConfirm })` |
| `->hint($teks, 'success')` | `hint`, `hintTone: 'success'` |
| `MrCatzFormField::file()` / `fileupload()` + `->preview($url, w, h)` | `field.file()` / `field.fileUpload()` + `preview`, `previewWidth`, `previewHeight`, `onUpload`, `onDelete` |
| `MrCatzFormField::dateRange(..., 'month_year')` | `field.dateRange(name, label, { format: 'month' })` |
| `MrCatzFormField::rating()` / `chooser()` / `html()` | `field.rating()` / `field.chooser()` / `field.html()` |
| `MrCatzFormField::editor()` / `editorAdvance()` | `field.editor()` / `field.editorAdvanced()` + entry `/editor`, `/editor-advanced` |
| `->uploadPath()` + `config('mrcatz.editor_image')` | `upload: (file) => Promise<url>` (tanpa = base64) |
| `MrCatzFormField::mapPicker(..., showRadius:)` | `field.map(name, label, { provider, apiKey, center, zoom, radius, height, theme })` + entry `/map` |
| `->style('primary')` / `->size('sm')` | `tone: 'primary'` / `size: 'sm'` |
| `->margin()` / `->padding()` | `class: 'mt-4 px-2'` |
| `->debounce(500)` | `onChangeDebounce: 500` |
| `$messages` | `messages: { required: '...', min: '...' }` |
| `$formGap` / `$formColumnGap` | `gap` / `column-gap` (`form-gap` / `form-column-gap` di `<MrcCrudTable>`) |
| `form-standalone` `submitStyle` | `<MrcFormPage submit-tone="success">` |
| `@section('forms')` (tanpa `setForm()`) | slot `#form="{ values, errors, set, mode, row, submit }"` di `<MrcCrudTable>` |
| `->rowSpan(4)` / `->mobileOrder(-1)` | `rowSpan: 4` / `mobileOrder: -1` |
| `form-standalone.blade.php` | `<MrcFormPage :submit="..." button-card />` |
| `breadcrumbs.blade.php` + `$breadcrumbs` | `<MrcBreadcrumbs :items="[{ title, to }]" />` |
| `mrcatz_icon('nama')` (Material) | `<MrcIcon name="nama" />` — ikon bawaan SVG, nama lain = Material Symbols |
| `config('mrcatz.icon_set')`, `custom_icons`, `form_icons` | `createMrcatz({ icons: { set, custom } })` |
| `rules: 'required\|min:8'` | `required`, `minLength`, `validate`, atau `schema` (zod/valibot) |
| `MrCatzEvent::*` (event Livewire) | prop/handler biasa — tidak ada event global |

> Contoh aplikasi lengkap (NestJS + Nuxt, setara `mrcatz-laravel-template`): **mrcatz-js-template**.

## Pengembangan

```bash
bun install
bun run dev        # playground di http://localhost:5178 (data in-memory)
bun run test       # vitest: core, server, komponen
bun run typecheck
bun run build      # dist/ untuk ketiga paket
```

Build memakai runtime Bun (`bun --bun`) karena tsup 9 & Vite 8 butuh Node ≥ 20.19.

## Publish ke npm

Paket saling bergantung dengan versi semver biasa (bukan `workspace:*`), jadi aman untuk `npm publish`.
Bun tetap menautkan paket lokal saat pengembangan karena versinya cocok.

```bash
npm login
# urutan penting: core dulu karena server & vue bergantung padanya
cd packages/core   && npm publish --access public
cd ../server       && npm publish --access public
cd ../vue          && npm publish --access public
```

`prepublishOnly` menjalankan build otomatis. Untuk rilis berikutnya, naikkan `version` ketiga paket
(dan rentang `@mrcatz/datatable-core` di `server` & `vue` bila API core berubah), lalu ulangi langkah di atas.
Cek isi tarball lebih dulu dengan `npm pack --dry-run`.

## Lisensi

MIT
