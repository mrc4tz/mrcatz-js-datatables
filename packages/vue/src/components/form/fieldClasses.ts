import type { Tone } from '../../columns';
import type { FieldDef, FieldSize } from '../../fields';

/*
 * Kelas warna & ukuran daisyUI per komponen (pengganti `mrcatz_fb_classes()`
 * untuk `->style()` / `->size()`). Ditulis literal — jangan dirangkai
 * dinamis — agar terdeteksi pemindai Tailwind dari `dist/`.
 */
export type StyledComponent = 'input' | 'select' | 'textarea' | 'file-input' | 'toggle' | 'checkbox' | 'radio' | 'range' | 'rating';

const TONES: Record<StyledComponent, Partial<Record<Tone, string>>> = {
  input: { neutral: 'input-neutral', primary: 'input-primary', secondary: 'input-secondary', accent: 'input-accent', info: 'input-info', success: 'input-success', warning: 'input-warning', error: 'input-error', ghost: 'input-ghost' },
  select: { neutral: 'select-neutral', primary: 'select-primary', secondary: 'select-secondary', accent: 'select-accent', info: 'select-info', success: 'select-success', warning: 'select-warning', error: 'select-error', ghost: 'select-ghost' },
  textarea: { neutral: 'textarea-neutral', primary: 'textarea-primary', secondary: 'textarea-secondary', accent: 'textarea-accent', info: 'textarea-info', success: 'textarea-success', warning: 'textarea-warning', error: 'textarea-error', ghost: 'textarea-ghost' },
  'file-input': { neutral: 'file-input-neutral', primary: 'file-input-primary', secondary: 'file-input-secondary', accent: 'file-input-accent', info: 'file-input-info', success: 'file-input-success', warning: 'file-input-warning', error: 'file-input-error', ghost: 'file-input-ghost' },
  toggle: { neutral: 'toggle-neutral', primary: 'toggle-primary', secondary: 'toggle-secondary', accent: 'toggle-accent', info: 'toggle-info', success: 'toggle-success', warning: 'toggle-warning', error: 'toggle-error' },
  checkbox: { neutral: 'checkbox-neutral', primary: 'checkbox-primary', secondary: 'checkbox-secondary', accent: 'checkbox-accent', info: 'checkbox-info', success: 'checkbox-success', warning: 'checkbox-warning', error: 'checkbox-error' },
  radio: { neutral: 'radio-neutral', primary: 'radio-primary', secondary: 'radio-secondary', accent: 'radio-accent', info: 'radio-info', success: 'radio-success', warning: 'radio-warning', error: 'radio-error' },
  range: { neutral: 'range-neutral', primary: 'range-primary', secondary: 'range-secondary', accent: 'range-accent', info: 'range-info', success: 'range-success', warning: 'range-warning', error: 'range-error' },
  rating: {},
};

const SIZES: Record<StyledComponent, Record<FieldSize, string>> = {
  input: { xs: 'input-xs', sm: 'input-sm', md: 'input-md', lg: 'input-lg', xl: 'input-xl' },
  select: { xs: 'select-xs', sm: 'select-sm', md: 'select-md', lg: 'select-lg', xl: 'select-xl' },
  textarea: { xs: 'textarea-xs', sm: 'textarea-sm', md: 'textarea-md', lg: 'textarea-lg', xl: 'textarea-xl' },
  'file-input': { xs: 'file-input-xs', sm: 'file-input-sm', md: 'file-input-md', lg: 'file-input-lg', xl: 'file-input-xl' },
  toggle: { xs: 'toggle-xs', sm: 'toggle-sm', md: 'toggle-md', lg: 'toggle-lg', xl: 'toggle-xl' },
  checkbox: { xs: 'checkbox-xs', sm: 'checkbox-sm', md: 'checkbox-md', lg: 'checkbox-lg', xl: 'checkbox-xl' },
  radio: { xs: 'radio-xs', sm: 'radio-sm', md: 'radio-md', lg: 'radio-lg', xl: 'radio-xl' },
  range: { xs: 'range-xs', sm: 'range-sm', md: 'range-md', lg: 'range-lg', xl: 'range-xl' },
  rating: { xs: 'rating-xs', sm: 'rating-sm', md: 'rating-md', lg: 'rating-lg', xl: 'rating-xl' },
};

/** Kelas `{komponen}-{tone} {komponen}-{size}` untuk field. */
export function styleClasses(component: StyledComponent, f: FieldDef): string {
  return [f.tone && TONES[component][f.tone], f.size && SIZES[component][f.size]].filter(Boolean).join(' ');
}
