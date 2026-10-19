# @mrcatz/datatable-server

Engine MrCatz DataTable untuk **Prisma** + integrasi **NestJS**: query string → `where`/`orderBy`/pagination,
filter (select, multi Termasuk/Kecuali, tanggal, rentang tanggal, kustom), pencarian berbobot dengan toleransi
salah ketik, peringkat relevansi PostgreSQL (opsional), whitelist sort, schema filter dinamis, dan export.

```ts
import { defineDataTable, filter } from '@mrcatz/datatable-server';
import { DataTableExceptionFilter, DataTableParams } from '@mrcatz/datatable-server/nest';

const table = defineDataTable({
  model: prisma.laporan,
  search: { columns: [{ field: 'judul', weight: 3 }, 'nomor', 'pelapor.nama'] },
  filters: [filter.multi('status', 'Status', { field: 'status', options: STATUS, allowExclude: true })],
  sortable: ['judul', 'createdAt'],
  defaultSort: [{ key: 'createdAt', dir: 'desc' }],
});

@Get() list(@DataTableParams() q: RawQuery) { return table.query(q); } // → { data, meta }
```

Dokumentasi lengkap: https://github.com/mrc4tz/mrcatz-js-datatables#readme
