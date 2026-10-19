# MrCatz DataTable · JS

Versi JavaScript dari [`mrcatz/datatable`](https://github.com/mrc4tz/mrcatz-datatables) (Laravel Livewire) —
DataTable + Form Builder + CRUD untuk stack **NestJS + Prisma** di server dan **Vue 3 / Nuxt 4 + Tailwind v4 + daisyUI 5 + TanStack Query** di client.

| Paket | Isi |
|---|---|
| [`@mrcatz/datatable-core`](packages/core) | Protokol query (URL ⇄ objek), definisi filter, pencarian + highlight, engine in-memory, CSV. Tanpa dependensi. |
| [`@mrcatz/datatable-server`](packages/server) | `defineDataTable()` untuk Prisma: filter → `where`, pencarian, multi-sort aman (whitelist), relevansi PostgreSQL, export, integrasi NestJS. |
| [`@mrcatz/datatable-vue`](packages/vue) | `<MrcDataTable>`, `<MrcCrudTable>`, `<MrcForm>`, filter, inline edit, aksi massal, baris expand, kartu mobile, export CSV/PDF. |

## Fitur

- Pencarian multi-kata dengan **highlight** (aman XSS), bobot per kolom, **toleransi salah ketik** (trigram / `pg_trgm`), peringkat **relevansi**
- Filter **select**, **multi** (Termasuk/Kecuali), **tanggal** (hari/bulan/tahun/datetime + operator), **rentang tanggal** (dengan preset), filter **bertingkat** (`dependsOn`), **preset filter** tersimpan
- **Multi-sort** (Shift+klik), sembunyikan/urutkan/ubah lebar kolom
- State tabel tersinkron ke **URL** (bisa dibagikan/di-bookmark), namespace per tabel
- **Inline edit** dengan validasi, **aksi massal** (konfirmasi / form), **baris expand**, **navigasi keyboard**
- Pagination bernomor atau **load more**, **kartu responsif** di mobile, skeleton, empty state
- **Form Builder** 25+ tipe field (termasuk tombol aksi & foto dengan unggah/hapus), section berbentuk kartu, kondisi tampil, opsi dinamis, validasi bawaan + [Standard Schema](https://standardschema.dev) (zod/valibot)
- **Form mandiri** di luar modal (`<MrcFormPage>`) & **breadcrumb** (`<MrcBreadcrumbs>`), ikon Material Symbols
- Export **CSV** (aman dari formula injection) & **PDF/cetak**, cakupan sesuai filter / semua / terpilih
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
  private table = penggunaTable(this.prisma);
  constructor(private prisma: PrismaService) {}

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

Butuh kontrol penuh? `useDataTable()` mengembalikan seluruh state & aksi (query, seleksi, kolom, filter) tanpa UI.

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
| `setTable()` + `CreateMrCatzTable()` | prop `columns` |
| `withColumn($head, $key, ...)` | `col.text(key, label, opts)` (+ `col.number`, `col.date`, `col.badge`) |
| `withCustomColumn($head, fn)` | `col.custom(label, render)` atau slot `#cell-{id}` |
| `withColumnIndex('No')` | `col.rowNumber()` |
| `withActionColumn($head, $editable, $deletable)` | `col.actions({ edit, delete, extra })` |
| `withColumnImage(...)` | `col.image(key, label, opts)` |
| `uppercase`, `th`, `gravity` | `uppercase`, `rowHeader`, `align` |
| `visible: false` | `hidden: true` |
| `setDefaultOrder()` / `addOrderBy()` | `defaultSort` / `tiebreaker` |
| `getRowPerPageOption()` | `perPageOptions` |
| `setPageName()` / `urlPrefix()` | `name` (client) / `prefix` (server) |
| `setSearchWord()` | `highlight()` / `<MrcHighlight>` |
| `enableBulk(fn)` | prop `selectable` |
| `enableEditable(fn)` | `col.text(..., { editable: { when } })` |
| `enableExpand(fn)` + `getExpandView()` | prop `expandable` + `expandFields` / slot `#expand` |
| `$showSearch`, `$typeSearch`, `$typeSearchDelay` | `searchable`, `searchMode`, `searchDebounce` |
| `$showAddButton` | `creatable` (otomatis bila ada `@create`) |
| `$usePagination = false` + `$maxRows` | `pagination: 'load-more'` |
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
| `dispatch_to_view()` / `show_notif()` | otomatis (toast + refresh) / `notify` |
| `$form_title` | `formTitle(mode, row)` |
| `$modalFullScreen` | `formSize: 'full'` |
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
| `->rowSpan(4)` / `->mobileOrder(-1)` | `rowSpan: 4` / `mobileOrder: -1` |
| `form-standalone.blade.php` | `<MrcFormPage :submit="..." button-card />` |
| `breadcrumbs.blade.php` + `$breadcrumbs` | `<MrcBreadcrumbs :items="[{ title, to }]" />` |
| `mrcatz_icon('nama')` (Material) | `<MrcIcon name="nama" />` — ikon bawaan SVG, nama lain = Material Symbols |
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
