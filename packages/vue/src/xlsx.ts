/**
 * Penulis XLSX minimal tanpa dependensi: satu sheet, header tebal berwarna,
 * baris zebra, lebar kolom otomatis. File dikemas sebagai ZIP "stored"
 * (tanpa kompresi) — cukup untuk dibuka Excel, LibreOffice, dan Google Sheets.
 */

const enc = new TextEncoder();

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** ZIP tanpa kompresi (metode 0). */
function zip(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(8, 0, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, f.data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, f.data.length, true);
    cd.setUint32(24, f.data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of all) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

const esc = (v: string) =>
  v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

function colName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function cell(ref: string, value: unknown, style: number): string {
  if (value === null || value === undefined || value === '') return `<c r="${ref}" s="${style}"/>`;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  const text = value instanceof Date ? value.toISOString() : String(value);
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
}

export interface XlsxOptions {
  sheetName?: string;
  /** Judul & subjudul di baris paling atas. */
  title?: string;
  subtitle?: string;
  /** Baris keterangan di atas header (mis. kondisi aktif). */
  preamble?: string[];
  /** @deprecated pakai `colors.headerBg`. */
  headerColor?: string;
  /** Warna (hex tanpa #), sama dengan `export_colors` di `config/mrcatz.php`. */
  colors?: Partial<ExportColors>;
}

/** Warna export Excel & PDF (pengganti `export_colors`). Hex tanpa `#`. */
export interface ExportColors {
  headerBg: string;
  headerText: string;
  headerBorder: string;
  titleText: string;
  subtitleText: string;
  border: string;
  stripe: string;
  bottomBorder: string;
}

export const DEFAULT_EXPORT_COLORS: ExportColors = {
  headerBg: '1B3A5C',
  headerText: 'FFFFFF',
  headerBorder: '0F2942',
  titleText: '1B3A5C',
  subtitleText: '6B7280',
  border: 'D1D5DB',
  stripe: 'F0F4F8',
  bottomBorder: '1B3A5C',
};

const hex = (v: string) => v.replace(/^#/, '').toUpperCase();
export function resolveExportColors(colors?: Partial<ExportColors>, headerColor?: string): ExportColors {
  const out = { ...DEFAULT_EXPORT_COLORS, ...(headerColor ? { headerBg: headerColor } : {}), ...colors };
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, hex(v)])) as unknown as ExportColors;
}

export function buildXlsx(headers: string[], rows: unknown[][], opts: XlsxOptions = {}): Uint8Array {
  const pre = opts.preamble ?? [];
  const lines: string[] = [];
  let r = 1;
  if (opts.title) lines.push(`<row r="${r}">${cell(`A${r}`, opts.title, 4)}</row>`), r++;
  if (opts.subtitle) lines.push(`<row r="${r}">${cell(`A${r}`, opts.subtitle, 5)}</row>`), r++;
  if (opts.title || opts.subtitle) r++;
  for (const p of pre) lines.push(`<row r="${r}">${cell(`A${r}`, p, 3)}</row>`), r++;
  if (pre.length) r++;
  lines.push(`<row r="${r}">${headers.map((h, i) => cell(`${colName(i)}${r}`, h, 1)).join('')}</row>`);
  r++;
  rows.forEach((row, ri) => {
    const last = ri === rows.length - 1;
    lines.push(`<row r="${r}">${row.map((v, i) => cell(`${colName(i)}${r}`, v, last ? (ri % 2 ? 7 : 6) : ri % 2 ? 2 : 0)).join('')}</row>`);
    r++;
  });
  const widths = headers.map((h, i) =>
    Math.min(60, Math.max(8, String(h).length + 2, ...rows.slice(0, 500).map((row) => String(row[i] ?? '').length + 2))),
  );
  const cols = `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${lines.join('')}</sheetData></worksheet>`;
  const c = resolveExportColors(opts.colors, opts.headerColor);
  const thin = (rgb: string) => ['left', 'right', 'top', 'bottom'].map((side) => `<${side} style="thin"><color rgb="FF${rgb}"/></${side}>`).join('');
  const bottom = `<left style="thin"><color rgb="FF${c.border}"/></left><right style="thin"><color rgb="FF${c.border}"/></right><top style="thin"><color rgb="FF${c.border}"/></top><bottom style="medium"><color rgb="FF${c.bottomBorder}"/></bottom>`;
  // fonts: 0 isi, 1 header, 2 keterangan, 3 judul, 4 subjudul · fills: 2 header, 3 zebra · borders: 1 isi, 2 header, 3 baris terakhir
  // cellXfs: 0 isi, 1 header, 2 zebra, 3 keterangan, 4 judul, 5 subjudul, 6/7 baris terakhir (+zebra)
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="5"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FF${c.headerText}"/><name val="Calibri"/></font><font><i/><sz val="9"/><color rgb="FF${c.subtitleText}"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF${c.titleText}"/><name val="Calibri"/></font><font><sz val="10"/><color rgb="FF${c.subtitleText}"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${c.headerBg}"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF${c.stripe}"/></patternFill></fill></fills><borders count="4"><border/><border>${thin(c.border)}</border><border>${thin(c.headerBorder)}</border><border>${bottom}</border></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="8"><xf borderId="1" applyBorder="1"/><xf fontId="1" fillId="2" borderId="2" applyFont="1" applyFill="1" applyBorder="1"/><xf fillId="3" borderId="1" applyFill="1" applyBorder="1"/><xf fontId="2" applyFont="1"/><xf fontId="3" applyFont="1"/><xf fontId="4" applyFont="1"/><xf borderId="3" applyBorder="1"/><xf fillId="3" borderId="3" applyFill="1" applyBorder="1"/></cellXfs></styleSheet>`;
  const name = esc((opts.sheetName ?? 'Data').slice(0, 31).replace(/[\\/?*[\]:]/g, ' '));
  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': sheet,
    'xl/styles.xml': styles,
  };
  return zip(Object.entries(files).map(([n, d]) => ({ name: n, data: enc.encode(d) })));
}
