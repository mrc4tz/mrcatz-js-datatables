# @mrcatz/datatable-vue

DataTable + Form Builder + CRUD untuk **Vue 3 / Nuxt 4** dengan **Tailwind CSS v4 + daisyUI 5** dan
**TanStack Query**: pencarian dengan highlight, filter (termasuk bertingkat & preset), multi-sort, kolom
yang bisa disembunyikan/diurutkan/diubah lebarnya, sinkron URL, inline edit, aksi massal, baris expand,
kartu mobile, navigasi keyboard, export CSV/PDF.

```bash
bun add @mrcatz/datatable-vue @tanstack/vue-query && bun add -d daisyui
```

```css
@import 'tailwindcss';
@plugin 'daisyui';
@source '../node_modules/@mrcatz/datatable-vue/dist'; /* sesuaikan path relatif */
```

```ts
app.use(VueQueryPlugin).use(createMrcatz({ locale: 'id' }));
```

```vue
<MrcCrudTable name="pengguna" entity="Pengguna" :source="source" :columns="columns" :fields="fields"
  :create="createUser" :update="updateUser" :remove="removeUser" />
```

Dokumentasi lengkap: https://github.com/mrc4tz/mrcatz-js-datatables#readme
