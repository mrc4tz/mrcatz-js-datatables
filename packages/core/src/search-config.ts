export interface SearchColumn {
  /** Kolom yang dicari; dot-path untuk relasi (`kategori.nama`). */
  field: string;
  /** Bobot relevansi (default 1). Kolom berbobot tinggi naik ke atas hasil. */
  weight?: number;
  /** Cara mencocokkan teks. Default `contains`. */
  mode?: 'contains' | 'startsWith' | 'equals';
  /** Kolom angka hanya dicocokkan bila kata kuncinya angka (pakai `equals`). */
  type?: 'string' | 'number';
  /**
   * Nama kolom asli di database bila berbeda dari nama field Prisma (`@map`).
   * Hanya dipakai engine server dalam mode relevansi (SQL mentah).
   */
  column?: string;
}

export type TypoTolerance =
  | false
  /** Pecah kata ≥ `minWordLength` menjadi trigram lalu cocokkan sebagian. */
  | { driver: 'trigram'; minWordLength?: number }
  /** Ekstensi PostgreSQL `pg_trgm` (operator `%`). Hanya engine server mode relevansi. */
  | { driver: 'pg_trgm'; minWordLength?: number };

export interface SearchConfig {
  columns: Array<string | SearchColumn>;
  /**
   * `all` — setiap kata kunci harus cocok di minimal satu kolom (default, hasil lebih presisi).
   * `any` — cukup salah satu kata cocok (perilaku versi Laravel); paling berguna bersama relevansi.
   */
  match?: 'all' | 'any';
  typoTolerance?: TypoTolerance | true;
}

export interface NormalizedSearch {
  columns: Array<Required<Pick<SearchColumn, 'field' | 'weight' | 'mode' | 'type'>> & { column?: string }>;
  match: 'all' | 'any';
  typo: { driver: 'none' | 'trigram' | 'pg_trgm'; minWordLength: number };
}

export function normalizeSearch(cfg: SearchConfig | undefined): NormalizedSearch {
  const raw = cfg?.typoTolerance;
  const typo =
    raw === true
      ? { driver: 'trigram' as const, minWordLength: 4 }
      : raw
        ? { driver: raw.driver, minWordLength: Math.max(1, raw.minWordLength ?? 4) }
        : { driver: 'none' as const, minWordLength: 4 };

  return {
    columns: (cfg?.columns ?? []).map((c) =>
      typeof c === 'string'
        ? { field: c, weight: 1, mode: 'contains', type: 'string' }
        : { weight: 1, mode: 'contains', type: 'string', ...c },
    ),
    match: cfg?.match ?? 'all',
    typo,
  };
}

/** Ambil nilai bersarang: `getPath(row, 'kategori.nama')`. */
export function getPath(row: unknown, path: string): unknown {
  let cur: unknown = row;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}
