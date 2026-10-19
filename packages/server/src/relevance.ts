import { splitKeywords, trigrams, type NormalizedSearch } from '@mrcatz/datatable-core';
import { DataTableConfigError } from './errors';

/**
 * Peringkat relevansi lewat SQL mentah PostgreSQL — setara `buildRelevanceSubquery`
 * versi Laravel. Prisma tidak bisa `ORDER BY SUM(CASE ...)`, jadi engine:
 *   1. menghitung skor kandidat dengan satu query mentah (identifier divalidasi,
 *      nilai selalu lewat parameter `$n` — aman dari SQL injection),
 *   2. lalu memfilter & mem-paginate lewat Prisma memakai id kandidat.
 */

export interface RelevanceConfig {
  /** Nama tabel di database (boleh `schema.tabel`). */
  table: string;
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

export function validateRelevance(cfg: RelevanceConfig, search: NormalizedSearch): void {
  quoteIdent(cfg.table);
  quoteIdent(cfg.primaryKeyColumn ?? cfg.primaryKey ?? 'id');
  for (const col of search.columns) {
    const name = col.column ?? col.field;
    if (name.includes('.')) {
      throw new DataTableConfigError(
        `Mode relevansi hanya mendukung kolom langsung di tabel "${cfg.table}"; "${col.field}" adalah relasi. ` +
          'Isi `column` dengan nama kolom asli atau keluarkan dari daftar pencarian.',
      );
    }
    quoteIdent(name);
  }
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

  const fuzzyOn = s.typo.driver !== 'none';
  const exactMultiplier = fuzzyOn ? 100 : 1;
  const scoreParts: string[] = [];
  const wordConds: string[] = [];

  for (const word of words) {
    const lower = word.toLowerCase();
    const fuzzy = fuzzyOn && word.length >= s.typo.minWordLength;
    const colConds: string[] = [];

    for (const col of s.columns) {
      const c = `LOWER(CAST(${quoteIdent(col.column ?? col.field)} AS TEXT))`;
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

  const pk = quoteIdent(cfg.primaryKeyColumn ?? cfg.primaryKey ?? 'id');
  const where = wordConds.join(s.match === 'all' ? ' AND ' : ' OR ');
  const limit = Math.max(1, Math.trunc(cfg.maxCandidates ?? 2000));
  const sql =
    `SELECT ${pk} AS id, (${scoreParts.join(' + ')}) AS score ` +
    `FROM ${quoteIdent(cfg.table)} WHERE ${where} ORDER BY score DESC LIMIT ${limit}`;
  return { sql, params };
}
