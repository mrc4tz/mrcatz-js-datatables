/**
 * Generator CRUD (pengganti `php artisan mrcatz:make` / `mrcatz:remove`).
 *
 * Fungsi di sini murni (tanpa I/O) agar mudah diuji; `cli.ts` yang menulis file.
 *
 *   npx mrcatz make Product --path admin
 *   → apps/api/src/admin/product/product.table.ts
 *     apps/api/src/admin/product/product.controller.ts
 *     apps/api/src/admin/product/product.module.ts
 *     apps/web/app/pages/admin/products.vue
 */

export interface ScaffoldOptions {
  /** Nama resource, mis. `Product` atau `order-item`. */
  name: string;
  /** Sub-folder, mis. `admin` (pengganti `--path`). */
  path?: string;
  /** Nama model Prisma (delegate `prisma.<model>`). Default camelCase nama. */
  model?: string;
  /** Nama tabel database untuk relevansi PostgreSQL. Default snake_case jamak. */
  table?: string;
  /** Folder sumber NestJS. Default `apps/api/src`. */
  apiDir?: string;
  /** Folder halaman Nuxt. Default `apps/web/app/pages`. `false` = tanpa halaman. */
  webDir?: string | false;
  /** Path import `PrismaService` relatif terhadap folder `apiDir`. Default `prisma/prisma.service`. */
  prismaService?: string;
  /** Prefix URL API yang dipakai halaman. Default `/api`. */
  apiBase?: string;
}

export interface ScaffoldFile {
  path: string;
  content: string;
}

const words = (s: string) =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
export const pascal = (s: string) => words(s).map((w) => w[0]!.toUpperCase() + w.slice(1)).join('');
export const camel = (s: string) => {
  const p = pascal(s);
  return p[0]!.toLowerCase() + p.slice(1);
};
export const kebab = (s: string) => words(s).join('-');
export const snake = (s: string) => words(s).join('_');
/** Bentuk jamak sederhana bahasa Inggris (cukup untuk nama tabel/URL). */
export function plural(s: string): string {
  if (/[^aeiou]y$/i.test(s)) return s.slice(0, -1) + 'ies';
  if (/(s|x|z|ch|sh)$/i.test(s)) return s + 'es';
  return s + 's';
}
const human = (s: string) => {
  const w = words(s).join(' ');
  return w[0]!.toUpperCase() + w.slice(1);
};

function relative(fromDir: string, toFile: string): string {
  const a = fromDir.split('/').filter(Boolean);
  const b = toFile.split('/').filter(Boolean);
  while (a.length && b.length && a[0] === b[0]) a.shift(), b.shift();
  const rel = [...a.map(() => '..'), ...b].join('/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

export function planScaffold(opts: ScaffoldOptions): ScaffoldFile[] {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(opts.name)) throw new Error(`Nama resource tidak valid: "${opts.name}"`);
  if (opts.path && !/^[a-zA-Z0-9_/-]+$/.test(opts.path)) throw new Error(`Path tidak valid: "${opts.path}"`);

  const Name = pascal(opts.name);
  const k = kebab(opts.name);
  const kPlural = plural(k);
  const model = opts.model ?? camel(opts.name);
  const table = opts.table ?? plural(snake(opts.name));
  const sub = (opts.path ?? '').split('/').filter(Boolean).map(kebab);
  const apiDir = (opts.apiDir ?? 'apps/api/src').replace(/\/$/, '');
  const moduleDir = [apiDir, ...sub, k].join('/');
  const prismaImport = relative(
    [...sub, k].join('/'),
    (opts.prismaService ?? 'prisma/prisma.service').replace(/\.ts$/, ''),
  );
  const route = [...sub, kPlural].join('/');
  const apiBase = (opts.apiBase ?? '/api').replace(/\/$/, '');
  const label = human(opts.name);
  const labelPlural = human(plural(opts.name));

  const files: ScaffoldFile[] = [
    {
      path: `${moduleDir}/${k}.table.ts`,
      content: `import { defineDataTable, filter } from '@mrcatz/datatable-server';
import type { PrismaService } from '${prismaImport}';

/** Tabel ${label}: kolom pencarian, filter, dan urutan yang diizinkan. */
export function create${Name}Table(prisma: PrismaService) {
  return defineDataTable({
    model: prisma.${model},
    search: {
      columns: [{ field: 'name', weight: 3 }],
      // relevance: { table: '${table}', db: prisma }, // peringkat relevansi PostgreSQL
    },
    filters: [
      // filter.select('status', 'Status', { field: 'status', options: [{ value: 'active', label: 'Active' }] }),
    ],
    sortable: ['id', 'name', 'createdAt'],
    defaultSort: [{ key: 'createdAt', dir: 'desc' }],
  });
}

export type ${Name}Table = ReturnType<typeof create${Name}Table>;
`,
    },
    {
      path: `${moduleDir}/${k}.controller.ts`,
      content: `import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseFilters } from '@nestjs/common';
import { DataTableExceptionFilter, DataTableParams } from '@mrcatz/datatable-server/nest';
import type { RawQuery } from '@mrcatz/datatable-server';
import { PrismaService } from '${prismaImport}';
import { create${Name}Table, type ${Name}Table } from './${k}.table';

@Controller('${route}')
@UseFilters(DataTableExceptionFilter)
export class ${Name}Controller {
  private readonly table: ${Name}Table;

  constructor(private readonly prisma: PrismaService) {
    this.table = create${Name}Table(prisma);
  }

  @Get()
  list(@DataTableParams() q: RawQuery) {
    return this.table.query(q);
  }

  @Get('schema')
  schema(@DataTableParams() q: RawQuery) {
    return this.table.describe(q);
  }

  @Get('export')
  export(@DataTableParams() q: RawQuery) {
    return this.table.exportRows(q);
  }

  // TODO: ganti \`any\` dengan DTO + class-validator.
  @Post()
  create(@Body() body: any) {
    return this.prisma.${model}.create({ data: body });
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.prisma.${model}.update({ where: { id }, data: body });
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.${model}.delete({ where: { id } });
  }

  @Post('bulk-delete')
  removeMany(@Body() body: { ids: number[] }) {
    return this.prisma.${model}.deleteMany({ where: { id: { in: body.ids } } });
  }
}
`,
    },
    {
      path: `${moduleDir}/${k}.module.ts`,
      content: `import { Module } from '@nestjs/common';
import { ${Name}Controller } from './${k}.controller';

/** Daftarkan di AppModule: \`imports: [${Name}Module]\`. */
@Module({ controllers: [${Name}Controller] })
export class ${Name}Module {}
`,
    },
  ];

  if (opts.webDir !== false) {
    const webDir = (opts.webDir ?? 'apps/web/app/pages').replace(/\/$/, '');
    const url = `${apiBase}/${route}`;
    files.push({
      path: [webDir, ...sub, `${kPlural}.vue`].join('/'),
      content: `<script setup lang="ts">
import { col, field, httpSource } from '@mrcatz/datatable-vue';

const source = httpSource({
  url: '${url}',
  schemaUrl: '${url}/schema',
  exportUrl: '${url}/export',
});

const columns = [
  col.rowNumber(),
  col.text('name', 'Name'),
  col.date('createdAt', 'Created'),
  col.actions(),
];

const fields = [field.text('name', 'Name', { required: true })];
</script>

<template>
  <MrcCrudTable
    name="${k}"
    entity="${label}"
    title="${labelPlural}"
    :source="source"
    :columns="columns"
    :fields="fields"
    :create="(v) => $fetch('${url}', { method: 'POST', body: v })"
    :update="(row, v) => $fetch(\`${url}/\${row.id}\`, { method: 'PATCH', body: v })"
    :remove="(row) => $fetch(\`${url}/\${row.id}\`, { method: 'DELETE' })"
    :remove-many="(rows) => $fetch('${url}/bulk-delete', { method: 'POST', body: { ids: rows.map((r) => r.id) } })"
    :delete-label="(row) => row.name"
  />
</template>
`,
    });
  }
  return files;
}
