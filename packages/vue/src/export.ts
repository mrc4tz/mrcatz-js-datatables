import { toCsv, type CsvOptions } from '@mrcatz/datatable-core';
import { displayValue, type ColumnDef } from './columns';
import { buildXlsx } from './xlsx';

export type ExportFormat = 'pdf' | 'csv' | 'excel';
export type ExportScope = 'filtered' | 'all' | 'selected';

export interface ExportTable {
  headers: string[];
  rows: unknown[][];
}

/** Kolom yang ikut diekspor: terlihat, bukan aksi, dan `exportable !== false`. */
export function exportColumns<T>(columns: ColumnDef<T>[]): ColumnDef<T>[] {
  return columns.filter((c) => c.kind !== 'actions' && c.exportable !== false && (c.key || c.exportValue || c.kind === 'rowNumber'));
}

export function buildExportTable<T>(columns: ColumnDef<T>[], rows: T[]): ExportTable {
  const cols = exportColumns(columns);
  return {
    headers: cols.map((c) => c.label),
    rows: rows.map((row, i) =>
      cols.map((c) => {
        if (c.exportValue) return c.exportValue(row);
        if (c.kind === 'rowNumber') return i + 1;
        return displayValue(c, row);
      }),
    ),
  };
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(table: ExportTable, filename: string, opts?: CsvOptions & { conditions?: string[] }) {
  // Kondisi aktif (bila diminta) ditulis sebagai baris keterangan di atas header.
  const pre = (opts?.conditions ?? []).map((c) => [c]);
  const csv = pre.length
    ? toCsv(pre[0]!.map(String), [...pre.slice(1), [], table.headers, ...table.rows], opts)
    : toCsv(table.headers, table.rows, opts);
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${filename}.csv`);
}

export function downloadXlsx(table: ExportTable, filename: string, opts: { conditions?: string[]; sheetName?: string } = {}) {
  const data = buildXlsx(table.headers, table.rows, { preamble: opts.conditions, sheetName: opts.sheetName });
  download(
    new Blob([data as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${filename}.xlsx`,
  );
}

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Buka jendela cetak berisi tabel rapi — pengguna memilih "Simpan sebagai PDF".
 * Tanpa dependensi PDF di bundle; semua nilai di-escape.
 */
export function printTable(table: ExportTable, title: string, opts: { conditions?: string[]; footer?: string } = {}) {
  const w = window.open('', '_blank', 'noopener=no,width=1024,height=768');
  if (!w) throw new Error('Popup diblokir browser');
  const conditions = opts.conditions?.length
    ? `<ul class="cond">${opts.conditions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`
    : '';
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body{font:12px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif;color:#111;margin:24px}
  h1{font-size:16px;margin:0 0 4px} .meta{color:#666;margin-bottom:12px}
  .cond{margin:0 0 12px;padding-left:18px;color:#444}
  table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:5px 7px;text-align:left;vertical-align:top}
  th{background:#f3f4f6;font-weight:600} tr:nth-child(even) td{background:#fafafa}
  @page{size:landscape;margin:12mm}
</style></head><body>
<h1>${esc(title)}</h1><div class="meta">${esc(opts.footer ?? '')}</div>${conditions}
<table><thead><tr>${table.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${table.rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
<script>window.onload=function(){window.print()}<\/script></body></html>`);
  w.document.close();
}
