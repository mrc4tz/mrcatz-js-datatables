<p align="center">
  <a href="https://www.npmjs.com/package/@mrc4tz/datatable-vue"><img src="https://img.shields.io/npm/v/@mrc4tz/datatable-vue?label=npm" alt="npm version"></a>
  <a href="https://github.com/mrc4tz/mrcatz-js-datatables/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License"></a>
  <a href="https://datatable.catzoid.tech/?stack=js"><img src="https://img.shields.io/badge/docs-datatable.catzoid.tech-F57927" alt="Docs"></a>
  <a href="https://nuxt.com"><img src="https://img.shields.io/badge/Nuxt-4-00DC82?style=flat-square&logo=nuxt&logoColor=white" alt="Nuxt"></a>
  <a href="https://vuejs.org"><img src="https://img.shields.io/badge/Vue-3.5%2B-4FC08D?style=flat-square&logo=vuedotjs&logoColor=white" alt="Vue"></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS"></a>
  <a href="https://daisyui.com"><img src="https://img.shields.io/badge/DaisyUI-5-5A0EF8?style=flat-square&logo=daisyui&logoColor=white" alt="DaisyUI"></a>
</p>

# @mrc4tz/datatable-vue

The web side of **[MrCatz DataTable for JavaScript](https://github.com/mrc4tz/mrcatz-js-datatables)** — **DataTable + Form Builder + CRUD** for **Vue 3 / Nuxt 4**, styled with **Tailwind CSS v4 + DaisyUI 5**.

## Highlights

- 🧩 **`<MrcCrudTable>`** — table, add/edit form, delete confirmation, toasts and refresh in one component
- 🔍 Search with highlighting, filters (dependent, presets), multi-sort, column visibility / reorder / resize
- ✏️ Inline editing, bulk actions, expandable rows, keyboard navigation, mobile card layout
- 🔗 Table state synced to the URL — shareable and bookmarkable
- 🧱 **Form Builder** — 30+ field types, Standard Schema validation (zod / valibot), optional rich text editors and map picker
- 📊 PDF, CSV & Excel export with custom colors and layouts
- 🌍 English & Indonesian built in, icon sets (SVG, Material, Font Awesome, custom)

## Quick install

```bash
npm i @mrc4tz/datatable-vue @tanstack/vue-query
npm i -D tailwindcss @tailwindcss/vite daisyui
```

```css
/* app/assets/css/main.css */
@import 'tailwindcss';
@plugin 'daisyui';
@source '../../../node_modules/@mrc4tz/datatable-vue/dist'; /* adjust the relative path */
```

```ts
// app/plugins/mrcatz.ts
import { VueQueryPlugin } from '@tanstack/vue-query';
import { createMrcatz } from '@mrc4tz/datatable-vue';

export default defineNuxtPlugin((nuxt) => {
  nuxt.vueApp.use(VueQueryPlugin);
  nuxt.vueApp.use(createMrcatz({ locale: 'en' }));
});
```

```vue
<MrcCrudTable
  entity="Product" :source="source" :columns="columns" :fields="fields"
  :create="createProduct" :update="updateProduct" :remove="removeProduct"
/>
<MrcToaster />
```

Pair it with [`@mrc4tz/datatable-server`](https://www.npmjs.com/package/@mrc4tz/datatable-server) on the API side.

📖 **[Documentation →](https://datatable.catzoid.tech/?stack=js)**

## License

MIT
