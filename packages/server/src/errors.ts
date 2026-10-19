/**
 * Kesalahan yang berasal dari input pengguna (query string) — mis. kolom sort
 * yang tidak diizinkan atau tanggal tidak valid. Integrasi NestJS memetakan
 * ini ke HTTP 400, bukan 500.
 */
export class DataTableQueryError extends Error {
  override name = 'DataTableQueryError';
  readonly status = 400;
}

/** Kesalahan konfigurasi oleh developer (terjadi saat `defineDataTable`). */
export class DataTableConfigError extends Error {
  override name = 'DataTableConfigError';
}
