export interface CsvOptions {
  /** Pemisah kolom. Default `,`; pakai `;` untuk Excel berlokal Indonesia. */
  delimiter?: string;
  /** Tambah BOM UTF-8 agar Excel membaca karakter non-ASCII dengan benar. Default `true`. */
  bom?: boolean;
}

/**
 * Sel yang diawali `= + - @` dieksekusi sebagai rumus oleh Excel/Sheets
 * (CSV injection). Prefiks apostrof membuatnya tampil sebagai teks biasa.
 */
function neutralizeFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function cell(value: unknown, delimiter: string): string {
  if (value === null || value === undefined) return '';
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const text = typeof value === 'number' ? raw : neutralizeFormula(raw);
  return /["\r\n]/.test(text) || text.includes(delimiter) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][], opts: CsvOptions = {}): string {
  const d = opts.delimiter ?? ',';
  const lines = [headers, ...rows].map((r) => r.map((v) => cell(v, d)).join(d));
  return (opts.bom === false ? '' : '﻿') + lines.join('\r\n');
}
