import { evalCondition, isInput, isVisible, mapRadius, type FieldDef, type FormValues, type ValidationRule } from './fields';
import type { MessageKey } from './i18n';
import type { MrcatzContext } from './config';

/**
 * Kontrak Standard Schema v1 (https://standardschema.dev) — didukung zod ≥3.24,
 * valibot, arktype. Tanpa dependensi ke library mana pun.
 */
export interface StandardSchema {
  '~standard': {
    version: 1;
    validate(value: unknown):
      | { value?: unknown; issues?: ReadonlyArray<{ message: string; path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> }> }
      | Promise<{ value?: unknown; issues?: ReadonlyArray<{ message: string; path?: ReadonlyArray<PropertyKey | { key: PropertyKey }> }> }>;
  };
}

export type FormErrors = Record<string, string>;

/** Lempar dari handler simpan untuk menampilkan error per field dari server. */
export class MrcFormError extends Error {
  override name = 'MrcFormError';
  constructor(
    public fields: FormErrors,
    message = 'Validasi gagal',
  ) {
    super(message);
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmpty(v: unknown, f?: FieldDef): boolean {
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) return true;
  if (f?.type === 'dateRange') {
    const r = v as { from?: unknown; to?: unknown };
    return !r.from && !r.to;
  }
  if (f?.type === 'map') {
    const p = v as { lat?: unknown; lng?: unknown };
    return p.lat === null || p.lat === undefined || p.lat === '' || p.lng === null || p.lng === undefined || p.lng === '';
  }
  return false;
}

/** Tipe yang nilainya string ISO sehingga `min`/`max` dibandingkan sebagai teks. */
const ISO_TYPES = ['date', 'time', 'datetime', 'month'];

/** Pesan error: pakai `field.messages[rule]` bila ada, selain itu teks i18n. */
function message(f: FieldDef, rule: ValidationRule, key: MessageKey, params: Record<string, unknown>, t: MrcatzContext['t']): string {
  const custom = f.messages?.[rule];
  if (custom) return custom.replace(/\{(\w+)\}/g, (_, p: string) => String(params[p] ?? ''));
  return t(key, params);
}

function kb(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB` : `${Math.round(bytes / 1024)} KB`;
}

/** Pesan error ukuran berkas (dipakai juga saat memilih berkas). */
export function maxSizeMessage(f: FieldDef, t: MrcatzContext['t']): string {
  return message(f, 'maxSize', 'form.maxSize', { label: f.label ?? f.name ?? '', max: kb(f.maxSize ?? 0) }, t);
}

/** Cek aturan bawaan satu field (tanpa `required`). Kembalikan `[key, pesan]` atau `null`. */
function checkRules(f: FieldDef & { name: string }, v: any, values: FormValues, t: MrcatzContext['t']): [string, string] | null {
  const label = f.label ?? f.name;
  const p = { label, min: f.min, max: f.max };
  const fail = (rule: ValidationRule, key: MessageKey, params: Record<string, unknown> = p, at = f.name): [string, string] => [at, message(f, rule, key, params, t)];

  switch (f.type) {
    case 'email':
      if (!EMAIL.test(String(v))) return fail('email', 'form.invalidEmail');
      break;
    case 'url':
      if (!/^https?:\/\/\S+$/i.test(String(v))) return fail('url', 'form.invalidUrl');
      break;
    case 'number':
    case 'year':
    case 'range':
    case 'rating':
      if (f.min !== undefined && f.min !== '' && Number(v) < Number(f.min)) return fail('min', 'form.min');
      if (f.max !== undefined && f.max !== '' && Number(v) > Number(f.max)) return fail('max', 'form.max');
      break;
    case 'dateRange': {
      const r = v as { from?: string | null; to?: string | null };
      if (r.from && r.to && String(r.from) > String(r.to)) return fail('dateRange', 'form.dateRangeOrder');
      for (const x of [r.from, r.to]) {
        if (x && f.min !== undefined && String(x) < String(f.min)) return fail('min', 'form.min');
        if (x && f.max !== undefined && String(x) > String(f.max)) return fail('max', 'form.max');
      }
      break;
    }
    case 'map': {
      const m = v as { lat: number; lng: number; radius?: number | null };
      const lat = Number(m.lat);
      const lng = Number(m.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return fail('location', 'form.invalidLocation');
      const r = mapRadius(f);
      if (r && m.radius !== null && m.radius !== undefined && (Number(m.radius) < r.min || Number(m.radius) > r.max)) {
        return fail('location', 'form.radiusRange', { label, min: r.min, max: r.max });
      }
      break;
    }
    case 'file':
    case 'fileUpload': {
      const files = (Array.isArray(v) ? v : [v]).filter((x): x is File => typeof File !== 'undefined' && x instanceof File);
      if (f.maxSize && files.some((x) => x.size > f.maxSize!)) return [f.name, maxSizeMessage(f, t)];
      break;
    }
    default:
      if (ISO_TYPES.includes(f.type)) {
        if (f.min !== undefined && String(v) < String(f.min)) return fail('min', 'form.min');
        if (f.max !== undefined && String(v) > String(f.max)) return fail('max', 'form.max');
      }
  }
  if (typeof v === 'string') {
    if (f.minLength && v.length < f.minLength) return fail('minLength', 'form.minLength', { label, min: f.minLength });
    if (f.maxLength && v.length > f.maxLength) return fail('maxLength', 'form.maxLength', { label, max: f.maxLength });
  }
  if (f.type === 'password' && f.confirm && v !== values[`${f.name}_confirmation`]) {
    return fail('confirm', 'form.confirmMismatch', p, `${f.name}_confirmation`);
  }
  return null;
}

export async function validateFields(
  fields: FieldDef[],
  values: FormValues,
  t: MrcatzContext['t'],
  schema?: StandardSchema,
): Promise<FormErrors> {
  const errors: FormErrors = {};

  for (const f of fields) {
    if (!isInput(f) || !isVisible(f, values) || evalCondition(f.disabled, values)) continue;
    const v = values[f.name];
    const label = f.label ?? f.name;

    const requiredEmpty =
      isEmpty(v, f) ||
      ((f.type === 'checkbox' || f.type === 'toggle') && v !== true) ||
      // rentang tanggal wajib: kedua ujung harus terisi
      (f.type === 'dateRange' && (!v.from || !v.to));
    if (evalCondition(f.required, values) && requiredEmpty) {
      errors[f.name] = message(f, 'required', 'form.required', { label }, t);
      continue;
    }
    if (isEmpty(v, f)) continue;

    const failed = checkRules(f, v, values, t);
    if (failed) errors[failed[0]] = failed[1];

    if (!errors[f.name] && f.validate) {
      const res = await f.validate(v, values);
      if (typeof res === 'string') errors[f.name] = res;
    }
  }

  if (schema) {
    const res = await schema['~standard'].validate(values);
    for (const issue of res.issues ?? []) {
      const seg = issue.path?.[0];
      const key = String(typeof seg === 'object' && seg !== null ? seg.key : (seg ?? '_form'));
      errors[key] ??= issue.message;
    }
  }
  return errors;
}

/** Ambil pesan error yang bisa ditampilkan dari error HTTP (NestJS / ofetch / fetch). */
export function errorMessage(e: unknown, fallback: string): string {
  const err = e as { data?: { message?: unknown }; response?: { _data?: { message?: unknown } }; message?: unknown };
  const msg = err?.data?.message ?? err?.response?._data?.message ?? err?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return typeof msg === 'string' && msg ? msg : fallback;
}

export interface FormErrorOptions {
  /**
   * Nama field yang dikenal. Untuk pesan `ValidationPipe` NestJS bawaan
   * (`"email must be an email"`), kata pertama dicocokkan dengan daftar ini;
   * tanpa daftar, kata pertama selalu dianggap nama field.
   */
  fields?: string[] | FieldDef[];
  /** Pesan umum bila server tidak mengirim `message`. */
  message?: string;
}

function firstMessage(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return firstMessage(v[0]);
  if (v && typeof v === 'object') return firstMessage(Object.values(v)[0]);
  return undefined;
}

/**
 * Ubah error validasi dari server menjadi `MrcFormError` agar pesan tampil di
 * bawah input yang bersangkutan. Bentuk yang dikenali:
 * - Laravel / API umum (422): `{ message, errors: { field: 'pesan' | ['pesan'] } }`
 * - NestJS `ValidationPipe` bawaan (400): `{ message: ['email must be an email', ...] }`
 * - NestJS `exceptionFactory` berisi `ValidationError[]`: `{ message: [{ property, constraints }] }`
 * Body dibaca dari `e.data` (ofetch/`$fetch`), `e.response._data`, atau `e.response.data` (axios).
 * Key bertitik (`location.lat`) juga dipasang ke induknya (`location`).
 * Error lain dikembalikan apa adanya.
 */
export function toFormError(e: unknown, opts: FormErrorOptions = {}): unknown {
  if (e instanceof MrcFormError) return e;
  const err = e as { data?: unknown; response?: { _data?: unknown; data?: unknown } };
  const body = (err?.data ?? err?.response?._data ?? err?.response?.data) as { message?: unknown; errors?: unknown } | undefined;
  if (!body || typeof body !== 'object') return e;

  const known = opts.fields?.map((f) => (typeof f === 'string' ? f : f.name)).filter((n): n is string => !!n);
  const fields: FormErrors = {};
  const put = (key: string, msg: string | undefined) => {
    if (!key || !msg) return;
    fields[key] ??= msg;
    const root = key.split('.')[0]!;
    if (root !== key) fields[root] ??= msg;
  };

  if (body.errors && typeof body.errors === 'object' && !Array.isArray(body.errors)) {
    for (const [k, v] of Object.entries(body.errors)) put(k, firstMessage(v));
  }
  if (Array.isArray(body.message)) {
    for (const m of body.message) {
      if (typeof m === 'string') {
        const word = m.split(/\s+/)[0] ?? '';
        if (!known || known.includes(word) || known.includes(word.split('.')[0]!)) put(word, m);
      } else if (m && typeof m === 'object' && 'property' in m) {
        const ve = m as { property: string; constraints?: Record<string, string>; children?: Array<{ property: string; constraints?: Record<string, string> }> };
        put(ve.property, firstMessage(ve.constraints) ?? firstMessage(ve.children?.map((c) => c.constraints)));
      }
    }
  }
  if (!Object.keys(fields).length) return e;
  const msg = typeof body.message === 'string' ? body.message : (opts.message ?? 'Validasi gagal');
  return new MrcFormError(fields, msg);
}

/**
 * Jalankan aksi API; error validasi diteruskan sebagai `MrcFormError`.
 *
 * @example
 * :create="(v) => withFormErrors(() => api('/pengguna', { method: 'POST', body: v }))"
 */
export async function withFormErrors<T>(fn: () => Promise<T>, opts?: FormErrorOptions): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw toFormError(e, opts);
  }
}
