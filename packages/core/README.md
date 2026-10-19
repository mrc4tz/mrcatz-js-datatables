<p align="center">
  <a href="https://www.npmjs.com/package/@mrcatz/datatable-core"><img src="https://img.shields.io/npm/v/@mrcatz/datatable-core?label=npm" alt="npm version"></a>
  <a href="https://github.com/mrc4tz/mrcatz-js-datatables/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License"></a>
  <a href="https://datatable.catzoid.tech/?stack=js"><img src="https://img.shields.io/badge/docs-datatable.catzoid.tech-F57927" alt="Docs"></a>
</p>

# @mrcatz/datatable-core

The framework-free core of **[MrCatz DataTable for JavaScript](https://github.com/mrc4tz/mrcatz-js-datatables)** — zero dependencies.

You usually don't install this directly: it comes with [`@mrcatz/datatable-server`](https://www.npmjs.com/package/@mrcatz/datatable-server) and [`@mrcatz/datatable-vue`](https://www.npmjs.com/package/@mrcatz/datatable-vue).

## What's inside

- 🔗 **Query protocol** — URL ⇄ `TableQuery` (`search`, `page`, `limit`, `sort=key:dir,…`, `f.<id>=…`)
- 🎯 **Filter definitions** — `filter.select / multi / date / dateRange` with dependent options and dynamic bounds
- 🔍 **Search** — multi-keyword matching, per-column weights, trigram typo tolerance, XSS-safe `highlight()`
- 🗓️ **Date helpers** — `periodOf`, `rangeBounds`, `parseTimeOfDay` with fixed UTC offsets
- 🧮 **In-memory engine** — `createMemoryTable()` for client-side tables and tests
- 📄 **CSV** — `toCsv()` with formula-injection protection

```ts
import { createMemoryTable, filter, parseTableQuery } from '@mrcatz/datatable-core';

const table = createMemoryTable(rows, {
  search: { columns: [{ field: 'name', weight: 2 }, 'email'], typoTolerance: true },
  filters: [filter.multi('status', 'Status', { field: 'status', options: STATUS, allowExclude: true })],
});

table.query(parseTableQuery(new URLSearchParams(location.search))); // → { data, meta }
```

📖 **[Documentation →](https://datatable.catzoid.tech/?stack=js)**

## License

MIT
