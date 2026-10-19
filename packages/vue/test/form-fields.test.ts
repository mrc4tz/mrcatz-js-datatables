// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { defineComponent, h, nextTick, ref } from 'vue';
import {
  MrcCrudTable,
  MrcForm,
  MrcFormError,
  MrcFormPage,
  createMrcatz,
  field,
  initialValues,
  memorySource,
  toFormError,
  validateFields,
  withFormErrors,
  type FieldDef,
} from '../src';
import { translate, id as messagesId } from '../src/i18n';

const t = (k: never, p?: Record<string, unknown>) => translate(messagesId, k, p);

type FormApi = { validate: () => Promise<boolean>; payload: () => Record<string, unknown>; submit: () => Promise<void> };

/** Pasang MrcForm dengan v-model sungguhan agar perubahan terlihat. */
function setup(fields: FieldDef[], initial: Record<string, unknown> = {}, props: Record<string, unknown> = {}) {
  const values = ref<Record<string, unknown>>(initial);
  const errors = ref<Record<string, string>>({});
  const form = ref<FormApi>();
  const Host = defineComponent(() => () =>
    h(MrcForm, {
      ref: form,
      modelValue: values.value,
      'onUpdate:modelValue': (v: Record<string, unknown>) => (values.value = v),
      errors: errors.value,
      'onUpdate:errors': (v: Record<string, string>) => (errors.value = v),
      fields,
      ...props,
    }),
  );
  const w = mount(Host, { attachTo: document.body });
  return { w, values, errors, form: () => form.value! };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('nilai awal & defaultValue', () => {
  it('initialValues memberi nilai kosong per tipe baru', () => {
    const v = initialValues([
      field.chooser('c', 'C'),
      field.rating('r', 'R'),
      field.dateRange('d', 'D'),
      field.map('m', 'M'),
      field.map('mr', 'MR', { radius: true }),
      field.select('s', 'S', { multiple: true }),
      field.html('<b>x</b>'),
    ]);
    expect(v).toEqual({ c: [], r: null, d: { from: null, to: null }, m: { lat: null, lng: null }, mr: { lat: null, lng: null, radius: null }, s: [] });
  });

  it('MrcForm mengisi defaultValue untuk nilai yang masih undefined', async () => {
    const { values } = setup([field.toggle('aktif', 'Aktif', { defaultValue: true }), field.text('nama', 'Nama', { defaultValue: 'x' }), field.chooser('tag', 'Tag')], {
      nama: 'sudah ada',
    });
    await nextTick();
    expect(values.value).toEqual({ aktif: true, nama: 'sudah ada', tag: [] });
  });
});

describe('field.html & slot statis', () => {
  it('merender HTML mentah / komponen dan tidak masuk payload', async () => {
    const Comp = defineComponent(() => () => h('em', { class: 'komponen' }, 'hai'));
    const { w, form } = setup([field.html('<strong class="raw">Info</strong>'), field.html(Comp), field.slot('area', 'Area', { static: true }), field.text('a', 'A')], { a: '1' });
    expect(w.find('strong.raw').text()).toBe('Info');
    expect(w.find('em.komponen').exists()).toBe(true);
    await nextTick();
    expect(form().payload()).toEqual({ a: '1' });
  });
});

describe('field.rating', () => {
  it('merender bintang sebanyak max dan menyimpan angka', async () => {
    const { w, values } = setup([field.rating('skor', 'Skor', { max: 4, size: 'lg' })]);
    const stars = w.findAll('.rating input[type="radio"]');
    expect(stars).toHaveLength(4);
    expect(w.find('.rating').classes()).toContain('rating-lg');
    expect(stars[0]!.classes()).toEqual(expect.arrayContaining(['mask', 'mask-star-2', 'bg-warning']));
    await stars[2]!.trigger('change');
    expect(values.value.skor).toBe(3);
  });
});

describe('field.chooser', () => {
  const opts = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Opsi ${i + 1}` }));

  it('toggle tombol menghasilkan array berurutan sesuai opsi', async () => {
    const { w, values } = setup([field.chooser('pref', 'Preferensi', { options: opts.slice(0, 3) })]);
    const boxes = w.findAll('input.btn[type="checkbox"]');
    expect(boxes.map((b) => b.attributes('aria-label'))).toEqual(['Opsi 1', 'Opsi 2', 'Opsi 3']);
    (boxes[2]!.element as HTMLInputElement).checked = true;
    await boxes[2]!.trigger('change');
    (boxes[0]!.element as HTMLInputElement).checked = true;
    await boxes[0]!.trigger('change');
    expect(values.value.pref).toEqual([1, 3]);
    (boxes[2]!.element as HTMLInputElement).checked = false;
    await boxes[2]!.trigger('change');
    expect(values.value.pref).toEqual([1]);
  });

  it('kotak pencarian muncul bila opsi > 10', async () => {
    const { w } = setup([field.chooser('pref', 'Preferensi', { options: opts })]);
    const search = w.find('input[type="text"]');
    expect(search.exists()).toBe(true);
    await search.setValue('opsi 1');
    const shown = w.findAll('input.btn').filter((b) => (b.element as HTMLElement).style.display !== 'none');
    expect(shown.map((b) => b.attributes('aria-label'))).toEqual(['Opsi 1', 'Opsi 10', 'Opsi 11', 'Opsi 12']);
  });
});

describe('select multiple', () => {
  it('merender <select multiple> dan menyimpan array', async () => {
    const { w, values } = setup([field.select('roles', 'Peran', { multiple: true, options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }] })]);
    const sel = w.find('select');
    expect(sel.attributes('multiple')).toBeDefined();
    const el = sel.element as HTMLSelectElement;
    el.options[0]!.selected = true;
    el.options[2]!.selected = true;
    await sel.trigger('change');
    expect(values.value.roles).toEqual(['a', 'c']);
  });
});

describe('field.dateRange', () => {
  it('popover: isi Dari/Sampai lalu Terapkan (tukar otomatis bila terbalik)', async () => {
    const { w, values } = setup([field.dateRange('periode', 'Periode')]);
    await nextTick();
    const trigger = w.find('button.input');
    expect(trigger.text()).toContain('Pilih rentang tanggal');
    await trigger.trigger('click');
    await nextTick();
    const panel = document.body.querySelector('.mrc-popover')!;
    expect(panel.textContent).toContain('7 hari terakhir');
    const from = panel.querySelector<HTMLInputElement>('[data-part="from"]')!;
    const to = panel.querySelector<HTMLInputElement>('[data-part="to"]')!;
    from.value = '2024-05-10';
    from.dispatchEvent(new Event('input'));
    to.value = '2024-05-01';
    to.dispatchEvent(new Event('input'));
    panel.querySelector<HTMLButtonElement>('[data-part="apply"]')!.click();
    await nextTick();
    expect(values.value.periode).toEqual({ from: '2024-05-01', to: '2024-05-10' });
    expect(w.find('button.input').text()).toContain('2024-05-01');
  });

  it('preset hanya untuk format date; format month memakai input month', async () => {
    const { w } = setup([field.dateRange('bulan', 'Bulan', { format: 'month' })]);
    await w.find('button.input').trigger('click');
    await nextTick();
    const panel = document.body.querySelector('.mrc-popover')!;
    expect(panel.textContent).not.toContain('7 hari terakhir');
    expect(panel.querySelector('input')!.getAttribute('type')).toBe('month');
  });

  it('validasi: wajib kedua ujung, urutan, dan min', async () => {
    const f = [field.dateRange('p', 'Periode', { required: true, min: '2020-01-01' })];
    expect((await validateFields(f, { p: { from: '2024-01-01', to: null } }, t)).p).toBe('Periode wajib diisi');
    expect((await validateFields(f, { p: { from: '2024-02-01', to: '2024-01-01' } }, t)).p).toBe('Tanggal akhir tidak boleh sebelum tanggal awal');
    expect((await validateFields(f, { p: { from: '2019-02-01', to: '2024-01-01' } }, t)).p).toBe('Periode minimal 2020-01-01');
    expect(await validateFields(f, { p: { from: '2024-01-01', to: '2024-01-31' } }, t)).toEqual({});
  });
});

describe('field.file / fileUpload', () => {
  it('pratinjau berkas non-gambar berupa tautan + badge ekstensi', () => {
    const { w } = setup([field.file('dok', 'Dokumen', { preview: 'https://cdn.test/laporan%20akhir.pdf' })]);
    const a = w.find('a[href="https://cdn.test/laporan%20akhir.pdf"]');
    expect(a.text()).toContain('laporan akhir.pdf');
    expect(a.find('.badge').classes()).toContain('badge-error');
  });

  it('fileUpload: thumbnail gambar memakai previewWidth/previewHeight', () => {
    const { w } = setup([field.fileUpload('foto', 'Foto', { preview: '/img/a.jpg', previewWidth: 120, previewHeight: 60 })]);
    const thumb = w.find('img[src="/img/a.jpg"]').element.parentElement!;
    expect(thumb.style.width).toBe('120px');
    expect(thumb.style.height).toBe('60px');
    expect(w.text()).toContain('File saat ini');
  });

  it('maxSize ditolak saat memilih berkas', async () => {
    const { w, values, errors } = setup([field.file('dok', 'Dokumen', { maxSize: 1024 })]);
    const input = w.find('input[type="file"]');
    Object.defineProperty(input.element, 'files', { value: [new File(['x'.repeat(2048)], 'a.txt')], configurable: true });
    await input.trigger('change');
    await nextTick();
    expect(errors.value.dok).toBe('Ukuran Dokumen maksimal 1 KB');
    expect(values.value.dok).toBe('');
  });

  it('onUpload: nilai kembalian (URL) menjadi nilai field & pratinjau', async () => {
    const onUpload = vi.fn(async () => 'https://cdn.test/up/berkas.zip');
    const { w, values } = setup([field.file('dok', 'Dokumen', { onUpload })]);
    const input = w.find('input[type="file"]');
    const file = new File(['x'], 'berkas.zip');
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
    await input.trigger('change');
    await flushPromises();
    expect(onUpload).toHaveBeenCalledWith(file, expect.objectContaining({ set: expect.any(Function) }));
    expect(values.value.dok).toBe('https://cdn.test/up/berkas.zip');
    expect(w.find('a .badge').classes()).toContain('badge-warning');
  });

  it('onDelete: tombol hapus memakai konfirmasi', async () => {
    const onDelete = vi.fn();
    const { w } = setup([field.file('dok', 'Dokumen', { preview: '/a.pdf', onDelete, deleteConfirm: 'Hapus dokumen?' })]);
    await w.find('button.btn-error').trigger('click');
    await nextTick();
    expect(document.body.textContent).toContain('Hapus dokumen?');
    const confirm = [...document.body.querySelectorAll('dialog button')].find((b) => b.textContent?.includes('Hapus'))!;
    (confirm as HTMLButtonElement).click();
    await flushPromises();
    expect(onDelete).toHaveBeenCalled();
  });
});

describe('gaya, ukuran, margin & jarak grid', () => {
  it('tone/size menjadi kelas daisyUI; warna default tidak bertabrakan', () => {
    const { w } = setup([
      field.text('a', 'A', { tone: 'success', size: 'sm' }),
      field.select('b', 'B', { size: 'lg', options: [] }),
      field.toggle('c', 'C', { tone: 'warning' }),
      field.toggle('d', 'D'),
      field.text('e', 'E', { class: 'mt-8 px-2' }),
    ]);
    expect(w.find('label.input').classes()).toEqual(expect.arrayContaining(['input-success', 'input-sm']));
    expect(w.find('select').classes()).toContain('select-lg');
    const toggles = w.findAll('input.toggle');
    expect(toggles[0]!.classes()).toContain('toggle-warning');
    expect(toggles[0]!.classes()).not.toContain('toggle-primary');
    expect(toggles[1]!.classes()).toContain('toggle-primary');
    expect(w.find('#mrc-f-e').element.closest('.col-span-1')!.className).toContain('mt-8 px-2');
  });

  it('gap / columnGap mengganti kelas gap-4', () => {
    const { w } = setup([field.text('a', 'A')], {}, { gap: '2rem', columnGap: '3rem' });
    const grid = w.find('.grid').element as HTMLElement;
    expect(grid.classList.contains('gap-4')).toBe(false);
    expect(grid.style.rowGap).toBe('2rem');
    expect(grid.style.columnGap).toBe('3rem');
  });
});

describe('onChangeDebounce', () => {
  it('onChange dipanggil sekali setelah jeda dengan nilai terakhir', async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const { w } = setup([field.text('u', 'Username', { onChange, onChangeDebounce: 300 })], { u: '' });
    const input = w.find('input');
    await input.setValue('a');
    await input.setValue('ab');
    await input.setValue('abc');
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0]![0]).toBe('abc');
  });
});

describe('validasi bawaan tambahan', () => {
  it('pesan kustom per aturan dengan placeholder', async () => {
    const f = [field.text('nama', 'Nama', { required: true, maxLength: 3, messages: { required: 'Isi {label} dulu', maxLength: 'Maks {max}!' } })];
    expect((await validateFields(f, { nama: '' }, t)).nama).toBe('Isi Nama dulu');
    expect((await validateFields(f, { nama: 'abcd' }, t)).nama).toBe('Maks 3!');
  });

  it('min/max untuk tanggal & maxLength', async () => {
    const f = [field.date('tgl', 'Tanggal', { min: '2024-01-01', max: '2024-12-31' }), field.text('k', 'Kode', { maxLength: 2 })];
    const errs = await validateFields(f, { tgl: '2025-01-01', k: 'abc' }, t);
    expect(errs).toEqual({ tgl: 'Tanggal maksimal 2024-12-31', k: 'Kode maksimal 2 karakter' });
  });

  it('lokasi peta: wajib, rentang lat/lng, dan radius', async () => {
    const f = [field.map('loc', 'Lokasi', { required: true, radius: { min: 10, max: 100 } })];
    expect((await validateFields(f, { loc: { lat: null, lng: null, radius: null } }, t)).loc).toBe('Lokasi wajib diisi');
    expect((await validateFields(f, { loc: { lat: 120, lng: 10 } }, t)).loc).toBe('Lokasi tidak valid');
    expect((await validateFields(f, { loc: { lat: 1, lng: 2, radius: 500 } }, t)).loc).toBe('Radius harus antara 10 dan 100 m');
    expect(await validateFields(f, { loc: { lat: 1, lng: 2, radius: 50 } }, t)).toEqual({});
  });

  it('chooser & rating wajib', async () => {
    const f = [field.chooser('c', 'Pilihan', { required: true }), field.rating('r', 'Rating', { required: true })];
    expect(await validateFields(f, { c: [], r: null }, t)).toEqual({ c: 'Pilihan wajib diisi', r: 'Rating wajib diisi' });
  });
});

describe('toFormError / withFormErrors', () => {
  it('Laravel / API umum: errors per field (string atau array), key bertitik ke induk', () => {
    const e = toFormError({ data: { message: 'Data tidak valid', errors: { email: ['Email sudah dipakai'], 'location.lat': 'Lat wajib' } } });
    expect(e).toBeInstanceOf(MrcFormError);
    expect((e as MrcFormError).fields).toEqual({ email: 'Email sudah dipakai', 'location.lat': 'Lat wajib', location: 'Lat wajib' });
    expect((e as MrcFormError).message).toBe('Data tidak valid');
  });

  it('NestJS ValidationPipe bawaan: kata pertama = nama field', () => {
    const body = { statusCode: 400, message: ['email must be an email', 'nama should not be empty', 'Something else'], error: 'Bad Request' };
    const e = toFormError({ response: { _data: body } }, { fields: [field.email('email', 'Email'), field.text('nama', 'Nama')] }) as MrcFormError;
    expect(e.fields).toEqual({ email: 'email must be an email', nama: 'nama should not be empty' });
  });

  it('NestJS exceptionFactory berisi ValidationError[] (axios)', () => {
    const body = { message: [{ property: 'username', constraints: { isNotEmpty: 'Username wajib' } }] };
    const e = toFormError({ response: { data: body } }) as MrcFormError;
    expect(e.fields).toEqual({ username: 'Username wajib' });
  });

  it('error lain dikembalikan apa adanya', async () => {
    const plain = new Error('boom');
    expect(toFormError(plain)).toBe(plain);
    expect(toFormError({ data: { message: 'Forbidden' } })).toEqual({ data: { message: 'Forbidden' } });
    await expect(withFormErrors(async () => Promise.reject({ data: { errors: { a: 'x' } } }))).rejects.toBeInstanceOf(MrcFormError);
    await expect(withFormErrors(async () => 42)).resolves.toBe(42);
  });
});

describe('MrcFormPage submitTone', () => {
  it('warna tombol simpan mengikuti submitTone', () => {
    const w = mount(MrcFormPage, { props: { modelValue: {}, fields: [field.text('a', 'A')], submit: () => {}, submitTone: 'success' } });
    const btn = w.findAll('button').find((b) => b.text().includes('Simpan'))!;
    expect(btn.classes()).toContain('btn-success');
    expect(btn.classes()).not.toContain('btn-primary');
  });
});

describe('MrcCrudTable #form', () => {
  it('slot form menggantikan MrcForm, simpan tetap lewat create + schema', async () => {
    const create = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const schema = {
      '~standard': {
        version: 1 as const,
        validate: (v: unknown) => ((v as { nama?: string }).nama ? { value: v } : { issues: [{ message: 'Nama kosong', path: ['nama'] }] }),
      },
    };
    const w = mount(MrcCrudTable as never, {
      props: { name: 'c', entity: 'Item', syncUrl: false, source: memorySource([{ id: 1, nama: 'A' }]), columns: [], create, schema },
      slots: {
        form: ({ values, errors, set }: { values: Record<string, string>; errors: Record<string, string>; set: (k: string, v: unknown) => void }) =>
          h('div', [
            h('input', { class: 'manual', value: values.nama ?? '', onInput: (e: Event) => set('nama', (e.target as HTMLInputElement).value) }),
            errors.nama ? h('p', { class: 'err' }, errors.nama) : null,
          ]),
      },
      global: { plugins: [[VueQueryPlugin, { queryClient }], createMrcatz({ registerComponents: false })] },
      attachTo: document.body,
    });
    (w.vm as unknown as { openCreate: () => void }).openCreate();
    await nextTick();
    const save = () => [...document.body.querySelectorAll('dialog button')].find((b) => b.textContent?.includes('Simpan')) as HTMLButtonElement;
    save().click();
    await flushPromises();
    expect(document.body.querySelector('.err')?.textContent).toBe('Nama kosong');
    expect(create).not.toHaveBeenCalled();
    const input = document.body.querySelector<HTMLInputElement>('input.manual')!;
    input.value = 'Baru';
    input.dispatchEvent(new Event('input'));
    await nextTick();
    expect(document.body.querySelector('.err')).toBeNull();
    save().click();
    await flushPromises();
    expect(create).toHaveBeenCalledWith({ nama: 'Baru' });
    w.unmount();
  });
});

describe('cadangan tanpa entry opsional', () => {
  it('editor → textarea, map → input lat/lng', async () => {
    const { w, values } = setup([field.editor('isi', 'Isi'), field.map('loc', 'Lokasi')]);
    const ta = w.find('textarea');
    await ta.setValue('<p>hai</p>');
    expect(values.value.isi).toBe('<p>hai</p>');
    expect(w.text()).toContain('@mrc4tz/datatable-vue/editor');
    const nums = w.findAll('input[type="number"]');
    await nums[0]!.setValue('1.5');
    expect(values.value.loc).toEqual({ lat: 1.5, lng: null });
  });
});
