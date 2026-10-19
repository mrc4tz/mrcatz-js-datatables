import { evalCondition, isInput, isVisible, type FieldDef, type FormValues } from './fields';
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

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
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

    if (evalCondition(f.required, values) && (isEmpty(v) || ((f.type === 'checkbox' || f.type === 'toggle') && v !== true))) {
      errors[f.name] = t('form.required', { label });
      continue;
    }
    if (isEmpty(v)) continue;

    if (f.type === 'email' && !EMAIL.test(String(v))) errors[f.name] = t('form.invalidEmail');
    else if (f.type === 'url' && !/^https?:\/\/\S+$/i.test(String(v))) errors[f.name] = t('form.invalidUrl');
    else if (f.type === 'number' && f.min !== undefined && Number(v) < Number(f.min)) errors[f.name] = t('form.min', { label, min: f.min });
    else if (f.type === 'number' && f.max !== undefined && Number(v) > Number(f.max)) errors[f.name] = t('form.max', { label, max: f.max });
    else if (f.minLength && String(v).length < f.minLength) errors[f.name] = t('form.minLength', { label, min: f.minLength });
    else if (f.type === 'password' && f.confirm && v !== values[`${f.name}_confirmation`]) errors[`${f.name}_confirmation`] = t('form.confirmMismatch');

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
