<p align="center">
  <a href="https://www.npmjs.com/package/@mrc4tz/datatable-server"><img src="https://img.shields.io/npm/v/@mrc4tz/datatable-server?label=npm" alt="npm version"></a>
  <a href="https://github.com/mrc4tz/mrcatz-js-datatables/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License"></a>
  <a href="https://datatable.catzoid.tech/?stack=js"><img src="https://img.shields.io/badge/docs-datatable.catzoid.tech-F57927" alt="Docs"></a>
  <a href="https://nestjs.com"><img src="https://img.shields.io/badge/NestJS-10%2B-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS"></a>
  <a href="https://www.prisma.io"><img src="https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma"></a>
</p>

# @mrc4tz/datatable-server

The API side of **[MrCatz DataTable for JavaScript](https://github.com/mrc4tz/mrcatz-js-datatables)** — **Prisma** engine + **NestJS** helpers.

## Highlights

- ⚡ **CRUD in minutes** — `npx mrcatz make Product --path admin` scaffolds the table, controller, module and Nuxt page
- 🔍 **Smart search** — per-column weights, typo tolerance, PostgreSQL relevance ranking (incl. joined columns), Meilisearch driver with filter pushdown (beta)
- 🎯 **Filters** — select, multi (include / exclude), date, date range, time, custom `where`, dependent options
- 🔒 **Safe by default** — sort whitelist, validated identifiers, bad input → `400` via `DataTableExceptionFilter`
- 📊 **Export rows** and dynamic filter **schema** endpoints
- 🖼️ **Editor images** — `editorImages()` upload / move-on-save / cleanup pipeline

## Quick install

```bash
npm i @mrc4tz/datatable-server
```

```ts
// products.controller.ts
import { Controller, Get, UseFilters } from '@nestjs/common';
import { defineDataTable, filter, type RawQuery } from '@mrc4tz/datatable-server';
import { DataTableExceptionFilter, DataTableParams } from '@mrc4tz/datatable-server/nest';

@Controller('products')
@UseFilters(DataTableExceptionFilter)
export class ProductsController {
  private readonly table: ReturnType<typeof createTable>;

  constructor(prisma: PrismaService) {
    this.table = createTable(prisma);
  }

  @Get() list(@DataTableParams() q: RawQuery) { return this.table.query(q); }          // → { data, meta }
  @Get('schema') schema(@DataTableParams() q: RawQuery) { return this.table.describe(q); }
  @Get('export') export(@DataTableParams() q: RawQuery) { return this.table.exportRows(q); }
}

const createTable = (prisma: PrismaService) =>
  defineDataTable({
    model: prisma.product,
    search: { columns: [{ field: 'name', weight: 3 }, 'sku'], typoTolerance: true },
    filters: [filter.multi('status', 'Status', { field: 'status', options: STATUS, allowExclude: true })],
    sortable: ['name', 'price', 'createdAt'],
    defaultSort: [{ key: 'createdAt', dir: 'desc' }],
  });
```

Pair it with [`@mrc4tz/datatable-vue`](https://www.npmjs.com/package/@mrc4tz/datatable-vue) on the web side.

📖 **[Documentation →](https://datatable.catzoid.tech/?stack=js)**

## License

MIT
