import { splitKeywords, trigrams, type NormalizedSearch } from '@mrcatz/datatable-core';
import { DataTableConfigError } from './errors';

/**
 * Peringkat relevansi lewat SQL mentah PostgreSQL — setara `buildRelevanceSubquery`
 * versi Laravel. Prisma tidak bisa `ORDER BY SUM(CASE ...)`, jadi engine:
 *   1. menghitung skor kandidat dengan satu query mentah (identifier divalidasi,
 *      nilai selalu lewat parameter `$n` — aman dari SQL injection),
 *   2. lalu memfilter & mem-paginate lewat Prisma memakai id kandidat.
 */

/**
 * JOIN tambahan agar kolom relasi ikut diberi skor (pengganti scoring
 * `'customers.name' => 3` yang memakai join dari `baseQuery()` versi Laravel).
 *
 * Semua bagian divalidasi sebagai identifier — `on` hanya boleh berupa
 * kesetaraan dua kolom `a.b = c.d`, bukan SQL bebas.
 */
export interface RelevanceJoin {
  /** Tabel yang di-join (boleh `schema.tabel`). */
  table: string;
  /** Alias tabel; default segmen terakhir `table`. */
  alias?: string;
  /** Kondisi join `'c.id = orders.customer_id'`; array digabung dengan AND. */
  on: string | string[];
  /** Default `left`. */
  type?: 'left' | 'inner';
}

export interface RelevanceConfig {
  /** Nama tabel di database (boleh `schema.tabel`). */
  table: string;
  /**
   * JOIN untuk kolom relasi. Kolom pencarian lalu boleh berupa `alias.kolom`
   * (lewat `column`, atau `field` dot-path yang awalannya cocok dengan alias).
   */
  joins?: RelevanceJoin[];
  /** Field primary key di Prisma. Default `id`. */
  primaryKey?: string;
  /** Nama kolom primary key di database bila berbeda (`@map`). */
  primaryKeyColumn?: string;
  /** Batas kandidat yang diberi skor. Default 2000. */
  maxCandidates?: number;
}

export interface RawExecutor {
  $queryRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function quoteIdent(name: string): string {
  const parts = name.split('.');
  for (const p of parts) {
    if (!IDENT.test(p)) throw new DataTableConfigError(`Identifier SQL tidak valid: "${name}"`);
  }
  return parts.map((p) => `"${p}"`).join('.');
}

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const lastSegment = (name: string) => name.slice(name.lastIndexOf('.') + 1);

/** `a.b = c.d` — tepat dua identifier berkualifikasi, tanpa ekspresi lain. */
const JOIN_ON = /^\s*([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\s*$/;

interface CompiledJoins {
  /** Nama relasi yang boleh dirujuk: tabel dasar + alias join. */
  names: Set<string>;
  sql: string;
}

function compileJoins(cfg: RelevanceConfig): CompiledJoins {
  const base = lastSegment(cfg.table);
  const names = new Set([base]);
  const parts: string[] = [];

  for (const j of cfg.joins ?? []) {
    quoteIdent(j.table);
    const alias = j.alias ?? lastSegment(j.table);
    quoteIdent(alias);
    if (alias.includes('.')) throw new DataTableConfigError(`Alias join tidak valid: "${alias}"`);
    if (names.has(alias)) {
      throw new DataTableConfigError(`Alias join duplikat: "${alias}" — isi \`alias\` yang berbeda.`);
    }
    if (j.type !== undefined && j.type !== 'left' && j.type !== 'inner') {
      throw new DataTableConfigError(`Tipe join tidak valid: "${String(j.type)}" (pilih 'left' atau 'inner').`);
    }
    names.add(alias);

    const conds = (Array.isArray(j.on) ? j.on : [j.on]).map((on) => {
      const m = typeof on === 'string' ? JOIN_ON.exec(on) : null;
      if (!m) {
        throw new DataTableConfigError(
          `Kondisi join "${String(on)}" tidak valid — hanya boleh bentuk \`a.kolom = b.kolom\`.`,
        );
      }
      for (const q of [m[1]!, m[3]!]) {
        if (!names.has(q)) {
          throw new DataTableConfigError(`Kondisi join "${on}" merujuk tabel/alias tidak dikenal: "${q}".`);
        }
      }
      return `${quoteIdent(`${m[1]}.${m[2]}`)} = ${quoteIdent(`${m[3]}.${m[4]}`)}`;
    });
    if (!conds.length) throw new DataTableConfigError(`Join "${j.table}" butuh kondisi \`on\`.`);

    const kw = j.type === 'inner' ? 'INNER JOIN' : 'LEFT JOIN';
    const as = alias === j.table ? '' : ` AS ${quoteIdent(alias)}`;
    parts.push(`${kw} ${quoteIdent(j.table)}${as} ON ${conds.join(' AND ')}`);
  }
  return { names, sql: parts.join(' ') };
}

/** Referensi kolom pencarian sebagai SQL (sudah di-quote & divalidasi). */
function columnRef(name: string, cfg: RelevanceConfig, joins: CompiledJoins): string {
  if (!cfg.joins?.length) {
    if (name.includes('.')) {
      throw new DataTableConfigError(
        `Mode relevansi tanpa \`joins\` hanya mendukung kolom langsung di tabel "${cfg.table}"; "${name}" adalah relasi. ` +
          'Tambahkan `relevance.joins`, isi `column` dengan nama kolom asli, atau keluarkan dari daftar pencarian.',
      );
    }
    return quoteIdent(name);
  }
  const parts = name.split('.');
  if (parts.length === 1) return quoteIdent(`${lastSegment(cfg.table)}.${name}`);
  if (parts.length !== 2 || !joins.names.has(parts[0]!)) {
    throw new DataTableConfigError(
      `Kolom relevansi "${name}" harus berbentuk \`alias.kolom\` dengan alias dari \`relevance.joins\` ` +
        `(${[...joins.names].join(', ')}). Isi \`column\` bila nama field Prisma berbeda.`,
    );
  }
  return quoteIdent(name);
}

export function validateRelevance(cfg: RelevanceConfig, search: NormalizedSearch): void {
  quoteIdent(cfg.table);
  quoteIdent(cfg.primaryKeyColumn ?? cfg.primaryKey ?? 'id');
  const joins = compileJoins(cfg);
  for (const col of search.columns) columnRef(col.column ?? col.field, cfg, joins);
}

export function buildRelevanceSql(
  search: string,
  cfg: RelevanceConfig,
  s: NormalizedSearch,
): { sql: string; params: unknown[] } | null {
  const words = splitKeywords(search);
  if (!words.length || !s.columns.length) return null;

  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  const joins = compileJoins(cfg);
  const fuzzyOn = s.typo.driver !== 'none';
  const exactMultiplier = fuzzyOn ? 100 : 1;
  const scoreParts: string[] = [];
  const wordConds: string[] = [];

  for (const word of words) {
    const lower = word.toLowerCase();
    const fuzzy = fuzzyOn && word.length >= s.typo.minWordLength;
    const colConds: string[] = [];

    for (const col of s.columns) {
      const c = `LOWER(CAST(${columnRef(col.column ?? col.field, cfg, joins)} AS TEXT))`;
      const pattern =
        col.mode === 'equals' ? escapeLike(lower) : col.mode === 'startsWith' ? `${escapeLike(lower)}%` : `%${escapeLike(lower)}%`;
      const like = `${c} LIKE ${p(pattern)} ESCAPE '\\'`;
      colConds.push(like);
      scoreParts.push(`CASE WHEN ${like} THEN ${Math.trunc(col.weight * exactMultiplier)} ELSE 0 END`);

      if (!fuzzy) continue;
      if (s.typo.driver === 'trigram') {
        for (const g of trigrams(word)) {
          const gl = `${c} LIKE ${p(`%${escapeLike(g)}%`)} ESCAPE '\\'`;
          colConds.push(gl);
          scoreParts.push(`CASE WHEN ${gl} THEN 1 ELSE 0 END`);
        }
      } else {
        const tg = `${c} % ${p(lower)}`;
        colConds.push(tg);
        scoreParts.push(`CASE WHEN ${tg} THEN 1 ELSE 0 END`);
      }
    }
    wordConds.push(`(${colConds.join(' OR ')})`);
  }

  const pkName = cfg.primaryKeyColumn ?? cfg.primaryKey ?? 'id';
  const where = wordConds.join(s.match === 'all' ? ' AND ' : ' OR ');
  const limit = Math.max(1, Math.trunc(cfg.maxCandidates ?? 2000));
  const score = `(${scoreParts.join(' + ')})`;

  if (!joins.sql) {
    const sql =
      `SELECT ${quoteIdent(pkName)} AS id, ${score} AS score ` +
      `FROM ${quoteIdent(cfg.table)} WHERE ${where} ORDER BY score DESC LIMIT ${limit}`;
    return { sql, params };
  }

  // Join one-to-many bisa menggandakan baris → ambil skor tertinggi per id.
  const pk = quoteIdent(`${lastSegment(cfg.table)}.${pkName}`);
  const sql =
    `SELECT id, MAX(score) AS score FROM (` +
    `SELECT ${pk} AS id, ${score} AS score FROM ${quoteIdent(cfg.table)} ${joins.sql} WHERE ${where}` +
    `) AS mrc_scored GROUP BY id ORDER BY score DESC LIMIT ${limit}`;
  return { sql, params };
}
