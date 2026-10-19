<p align="center">
  <a href="https://www.npmjs.com/package/@mrc4tz/datatable-vue"><img src="https://img.shields.io/npm/v/@mrc4tz/datatable-vue?label=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@mrc4tz/datatable-vue"><img src="https://img.shields.io/npm/dm/@mrc4tz/datatable-vue" alt="npm downloads"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License"></a>
  <a href="https://datatable.catzoid.tech/?stack=js"><img src="https://img.shields.io/badge/docs-datatable.catzoid.tech-F57927" alt="Docs"></a>
  <a href="https://nestjs.com"><img src="https://img.shields.io/badge/NestJS-10%2B-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS"></a>
  <a href="https://www.prisma.io"><img src="https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma"></a>
  <a href="https://nuxt.com"><img src="https://img.shields.io/badge/Nuxt-4-00DC82?style=flat-square&logo=nuxt&logoColor=white" alt="Nuxt"></a>
  <a href="https://vuejs.org"><img src="https://img.shields.io/badge/Vue-3.5%2B-4FC08D?style=flat-square&logo=vuedotjs&logoColor=white" alt="Vue"></a>
  <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS"></a>
  <a href="https://daisyui.com"><img src="https://img.shields.io/badge/DaisyUI-5-5A0EF8?style=flat-square&logo=daisyui&logoColor=white" alt="DaisyUI"></a>
</p>

# MrCatz DataTable for JavaScript

**DataTable + Form Builder** for **NestJS + Prisma** and **Nuxt (Vue 3)** — build complete admin pages in minutes.

The JavaScript version of [mrcatz/datatable](https://github.com/mrc4tz/mrcatz-datatables) (Laravel Livewire): same features, same look, same API shape.

📖 **[Full documentation →](https://datatable.catzoid.tech/?stack=js)**
🎮 **[Live demo →](https://datatable.catzoid.tech/demo)**

---

## What is this?

A complete, opinionated DataTable + CRUD toolkit for TypeScript stacks. Bundles everything you typically rebuild from scratch on every admin page — pagination, sorting, filtering, search, inline editing, bulk actions, expandable rows, exports, and a programmatic Form Builder — into a small set of composable APIs:

| Package | Where | What it does |
|---|---|---|
| [`@mrc4tz/datatable-server`](packages/server) | NestJS API | `defineDataTable()` on a Prisma model: search, filters, sort whitelist, paging, export rows, PostgreSQL relevance, Meilisearch driver, the `mrcatz` CLI |
| [`@mrc4tz/datatable-vue`](packages/vue) | Nuxt / Vue 3 | `<MrcDataTable>`, `<MrcCrudTable>`, `<MrcForm>`, `col.*`, `field.*`, `filter.*` — styled with Tailwind CSS + DaisyUI |
| [`@mrc4tz/datatable-core`](packages/core) | both | Framework-free query protocol, filter definitions, search & date helpers (installed automatically) |

Think of it as **"Filament's CRUD productivity, but you keep full control over your stack."** You choose your DaisyUI theme, your auth, your API shape — MrCatz slots into your existing Nest + Nuxt app instead of replacing it.

## Highlights

- ⚡ **CRUD in minutes** — `npx mrcatz make Product --path admin` scaffolds the Nest table, controller, module and the Nuxt page
- 🔍 **Smart search** — multi-keyword highlighting, per-column weights, typo tolerance (trigram / `pg_trgm`), PostgreSQL relevance ranking (incl. joined columns), optional Meilisearch driver (beta)
- 🎯 **Powerful filters** — select, multi (include / exclude), dependent, and full date / date-range / time filters with operator support and dynamic bounds
- ✏️ **Inline editing** — double-click any cell to edit, with validation, Tab to the next cell, per-row gating
- 📊 **PDF, CSV & Excel export** — zero-dependency `.xlsx` writer, custom colors, titles and print layouts
- 🧱 **Form Builder** — define add/edit forms in TypeScript: 30+ field types, sections, conditional fields, Standard Schema validation (zod / valibot), rich text editors and map picker as optional add-ons
- ☑️ **Bulk actions** & **expandable rows**
- 🔗 **Shareable state** — search, filters, sort, page and column layout live in the URL
- 📱 **Fully responsive** — adapts cleanly from desktop tables to mobile card layouts out of the box
- 🎨 **Themed via DaisyUI** — works with any DaisyUI theme, full control over colors

## Quick install

**API (NestJS + Prisma)**

```bash
npm i @mrc4tz/datatable-server
```

**Web (Nuxt 4)** — Tailwind CSS v4 + DaisyUI 5 are required: the components ship class names, your build compiles them.

```bash
npm i @mrc4tz/datatable-vue @tanstack/vue-query
npm i -D tailwindcss @tailwindcss/vite daisyui
```

```ts
// nuxt.config.ts
import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
  css: ['~/assets/css/main.css'],
  vite: { plugins: [tailwindcss()] },
});
```

```css
/* app/assets/css/main.css */
@import 'tailwindcss';
@plugin 'daisyui';
@source '../../../node_modules/@mrc4tz/datatable-vue/dist';
```

Register the plugin (it replaces `config/mrcatz.php`) and mount `<MrcToaster />` once in your layout for toasts and the image lightbox:

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
<!-- app/layouts/default.vue -->
<template>
  <slot />
  <MrcToaster />
</template>
```

Then generate your first CRUD page:

```bash
npx mrcatz make Product --path admin
```

Register the generated module and you're done — Nuxt routes the page by its file path:

```ts
// apps/api/src/app.module.ts
import { ProductModule } from './admin/product/product.module';

@Module({ imports: [ProductModule] })
export class AppModule {}
```

For the full setup walkthrough — including the exception filter, Excel/PDF export, Meilisearch, Docker, and theming — see the **[Quick Start guide](https://datatable.catzoid.tech/docs/quick-start?stack=js)**.

## Documentation

The complete reference, with Laravel and JavaScript code side by side for every feature, is hosted at **[datatable.catzoid.tech](https://datatable.catzoid.tech/?stack=js)**.

| Section | What's covered |
|---|---|
| [Getting Started](https://datatable.catzoid.tech/docs/introduction?stack=js) | Introduction, installation, quick-start |
| [Core Features](https://datatable.catzoid.tech/docs/columns?stack=js) | Columns, filters, search, sorting, pagination |
| [Editing & Actions](https://datatable.catzoid.tech/docs/inline-editing?stack=js) | Inline editing, bulk actions, expandable rows |
| [Form Builder](https://datatable.catzoid.tech/docs/form-builder?stack=js) | Programmatic forms, editors, map picker |
| [Export](https://datatable.catzoid.tech/docs/export?stack=js) | PDF, CSV & Excel with custom layouts |
| [Advanced Search](https://datatable.catzoid.tech/docs/advanced/scoring?stack=js) | Per-column scoring, typo tolerance, **Meilisearch (beta)** |
| [Customization](https://datatable.catzoid.tech/docs/customization/theming?stack=js) | Icons, localization, theming |
| [API Reference](https://datatable.catzoid.tech/docs/reference/api?stack=js) | Every prop, event, slot and option |

Coming from the Laravel package? **[MIGRATING.md](MIGRATING.md)** maps every Laravel method and property to its JS name.

## Requirements

- Node.js 20.19+ (or Bun 1.3+)
- NestJS 10+ and Prisma 7 (API)
- Nuxt 4 / Vue 3.5+ with TanStack Query 5 (web)
- Tailwind CSS v4
- DaisyUI v5
- PostgreSQL — only for relevance ranking and `pg_trgm` typo tolerance (other Prisma databases work for everything else)

## Optional dependencies

```bash
npm i meilisearch   # Meilisearch search driver (beta) — @mrc4tz/datatable-server/meilisearch
npm i quill         # Rich text editor field — import '@mrc4tz/datatable-vue/editor'
npm i tinymce       # Advanced rich text editor — import '@mrc4tz/datatable-vue/editor-advanced'
npm i leaflet       # Map picker field — import '@mrc4tz/datatable-vue/map'
```

## Built with Claude

A large portion of this package — and its documentation site — was built collaboratively with [Anthropic's Claude](https://claude.com). The maintainer focused on architecture decisions, requirements, and design trade-offs; Claude handled most of the implementation, tests, and docs writing. A reminder that AI-assisted development, when guided well, multiplies what one developer can ship.

## Issues & contributions

Bug reports and feature requests welcome at [github.com/mrc4tz/mrcatz-js-datatables/issues](https://github.com/mrc4tz/mrcatz-js-datatables/issues). Working on the code? See **[CONTRIBUTING.md](CONTRIBUTING.md)**.

## License

[MIT](LICENSE)
