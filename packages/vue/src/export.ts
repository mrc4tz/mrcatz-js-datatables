import { toCsv, type CsvOptions } from '@mrc4tz/datatable-core';
import { displayValue, type ColumnDef } from './columns';
import { buildXlsx, resolveExportColors, type ExportColors } from './xlsx';

export type ExportFormat = 'pdf' | 'csv' | 'excel';
export type ExportScope = 'filtered' | 'all' | 'selected';

export interface ExportTable {
  headers: string[];
  rows: unknown[][];
}

/** Konteks hook export. */
export interface ExportContext {
  format: ExportFormat;
  scope: ExportScope;
}

/**
 * Opsi `:exportable="{ ... }"` pada `<MrcDataTable>` (pengganti `$exportTitle`,
 * `beforeExport()`, `afterExport()`, `export_colors`).
 */
export interface ExportOptions {
  formats?: ExportFormat[];
  /** Nama file tanpa ekstensi; fungsi per format. Default dari judul tabel. */
  filename?: string | ((ctx: ExportContext) => string);
  /** Tambahkan `-YYYY-MM-DD` di nama file. Default `true`. */
  dateSuffix?: boolean;
  /** Judul di file (default judul tabel) & subjudul di bawahnya. */
  title?: string;
  subtitle?: string | ((ctx: ExportContext) => string);
  /** Warna Excel & PDF; menimpa `createMrcatz({ export: { colors } })`. */
  colors?: Partial<ExportColors>;
  /** Ubah header/baris sebelum ditulis (pengganti `beforeExport`). */
  transform?: (table: ExportTable, ctx: ExportContext & { rows: unknown[] }) => ExportTable | void;
  /** Dipanggil setelah file dibuat (pengganti `afterExport`). */
  onExported?: (ctx: ExportContext & { count: number }) => void;
  /**
   * Tata letak PDF/cetak sendiri (pengganti `vendor:publish --tag=mrcatz-export`):
   * kembalikan dokumen HTML lengkap. Nilai sel BELUM di-escape — pakai `escapeHtml`.
   */
  printTemplate?: PrintTemplate;
}

export interface PrintMeta {
  title: string;
  subtitle?: string;
  conditions?: string[];
  footer?: string;
  colors: ExportColors;
}
export type PrintTemplate = (table: ExportTable, meta: PrintMeta) => string;

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

export function downloadXlsx(
  table: ExportTable,
  filename: string,
  opts: { conditions?: string[]; sheetName?: string; title?: string; subtitle?: string; colors?: Partial<ExportColors> } = {},
) {
  const data = buildXlsx(table.headers, table.rows, {
    preamble: opts.conditions,
    sheetName: opts.sheetName,
    title: opts.title,
    subtitle: opts.subtitle,
    colors: opts.colors,
  });
  download(
    new Blob([data as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${filename}.xlsx`,
  );
}

/** Escape HTML untuk dipakai di `printTemplate`. */
export const escapeHtml = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Buka jendela cetak berisi tabel rapi — pengguna memilih "Simpan sebagai PDF".
 * Tanpa dependensi PDF di bundle; semua nilai di-escape.
 */
export function printTable(
  table: ExportTable,
  title: string,
  opts: { conditions?: string[]; footer?: string; subtitle?: string; colors?: Partial<ExportColors>; template?: PrintTemplate } = {},
) {
  const w = window.open('', '_blank', 'noopener=no,width=1024,height=768');
  if (!w) throw new Error('Popup diblokir browser');
  const c = resolveExportColors(opts.colors);
  if (opts.template) {
    const html = opts.template(table, { title, subtitle: opts.subtitle, conditions: opts.conditions, footer: opts.footer, colors: c });
    // Cetak otomatis setelah dokumen kustom selesai dimuat.
    w.document.write(html.includes('window.print') ? html : html.replace(/<\/body>/i, '<script>window.onload=function(){window.print()}<\/script></body>'));
    w.document.close();
    return;
  }
  const conditions = opts.conditions?.length
    ? `<ul class="cond">${opts.conditions.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>`
    : '';
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body{font:12px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif;color:#111;margin:24px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  h1{font-size:16px;margin:0 0 2px;color:#${c.titleText}} .sub{color:#${c.subtitleText};margin:0 0 4px} .meta{color:#${c.subtitleText};margin-bottom:12px}
  .cond{margin:0 0 12px;padding-left:18px;color:#${c.subtitleText}}
  table{width:100%;border-collapse:collapse;border-bottom:2px solid #${c.bottomBorder}} th,td{border:1px solid #${c.border};padding:5px 7px;text-align:left;vertical-align:top}
  th{background:#${c.headerBg};color:#${c.headerText};border-color:#${c.headerBorder};font-weight:600} tr:nth-child(even) td{background:#${c.stripe}}
  @page{size:landscape;margin:12mm}
</style></head><body>
<h1>${escapeHtml(title)}</h1>${opts.subtitle ? `<p class="sub">${escapeHtml(opts.subtitle)}</p>` : ''}<div class="meta">${escapeHtml(opts.footer ?? '')}</div>${conditions}
<table><thead><tr>${table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
<tbody>${table.rows.map((r) => `<tr>${r.map((v) => `<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>
<script>window.onload=function(){window.print()}<\/script></body></html>`);
  w.document.close();
}
