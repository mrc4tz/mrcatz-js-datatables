import {
  BadRequestException,
  Catch,
  createParamDecorator,
  type ArgumentsHost,
  type ExceptionFilter,
  type ExecutionContext,
} from '@nestjs/common';
import type { RawQuery } from '@mrcatz/datatable-core';
import { DataTableQueryError } from './errors';

/**
 * Ambil query string mentah untuk engine DataTable.
 *
 * Sengaja melewati `ValidationPipe` (yang bisa membuang kunci `f.*` saat
 * `whitelist: true`) — validasi dilakukan oleh engine sendiri.
 *
 * @example
 * @Get()
 * list(@DataTableParams() query: RawQuery) {
 *   return this.penggunaTable.query(query);
 * }
 */
export const DataTableParams = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RawQuery =>
    (ctx.switchToHttp().getRequest<{ query: RawQuery }>().query ?? {}) as RawQuery,
);

/**
 * Petakan `DataTableQueryError` (sort tak diizinkan, tanggal tidak valid) ke
 * HTTP 400. Daftarkan global (`app.useGlobalFilters(new DataTableExceptionFilter())`)
 * atau per controller dengan `@UseFilters(DataTableExceptionFilter)`.
 */
@Catch(DataTableQueryError)
export class DataTableExceptionFilter implements ExceptionFilter {
  catch(error: DataTableQueryError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<{
      status(code: number): { json(body: unknown): void };
    }>();
    const http = new BadRequestException(error.message);
    res.status(http.getStatus()).json(http.getResponse());
  }
}

/** Alternatif tanpa exception filter: bungkus pemanggilan engine. */
export async function withBadRequest<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof DataTableQueryError) throw new BadRequestException(e.message);
    throw e;
  }
}
