# @mrcatz/datatable-core

Inti MrCatz DataTable (JS), tanpa dependensi: protokol query (URL ⇄ `TableQuery`), definisi filter
(`filter.select / multi / date / dateRange`), pencarian multi-kata + `highlight()` yang aman XSS,
toleransi salah ketik (trigram), engine in-memory, dan `toCsv()`.

Dipakai bersama oleh [`@mrcatz/datatable-server`](https://www.npmjs.com/package/@mrcatz/datatable-server)
dan [`@mrcatz/datatable-vue`](https://www.npmjs.com/package/@mrcatz/datatable-vue).

```ts
import { createMemoryTable, filter, parseTableQuery } from '@mrcatz/datatable-core';

const table = createMemoryTable(rows, {
  search: { columns: [{ field: 'nama', weight: 2 }, 'email'], typoTolerance: true },
  filters: [filter.multi('status', 'Status', { field: 'status', options: STATUS, allowExclude: true })],
});
table.query(parseTableQuery(new URLSearchParams(location.search)));
```

Dokumentasi lengkap: https://github.com/mrc4tz/mrcatz-js-datatables#readme
