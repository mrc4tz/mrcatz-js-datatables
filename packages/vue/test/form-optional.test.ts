// @vitest-environment happy-dom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';
import Quill from 'quill';
import { MrcForm, field, type FieldDef } from '../src';
// Entry opsional mendaftarkan renderer-nya sendiri saat diimpor.
import '../src/editor';
import '../src/editor-advanced';
import '../src/map';

// Quill asli (devDependency) berjalan di happy-dom; CSS-nya cukup di-stub.
vi.mock('quill/dist/quill.snow.css', () => ({}));

// ---------------------------------------------------------------- Leaflet palsu
const leafletState = vi.hoisted(() => ({ map: null as any, marker: null as any, circle: null as any, tileUrl: '' }));
vi.mock('leaflet', () => {
  const evented = () => {
    const h: Record<string, (e?: any) => void> = {};
    return { h, on: (ev: string, fn: (e?: any) => void) => ((h[ev] = fn), undefined) };
  };
  const map = () => {
    const e = evented();
    const m = {
      ...e,
      view: null as any,
      panned: null as any,
      setView(ll: any, zoom: number) {
        m.view = { ll, zoom };
        return m;
      },
      panTo(ll: any) {
        m.panned = ll;
      },
      remove: vi.fn(),
    };
    m.on = (ev: string, fn: any) => ((e.h[ev] = fn), m) as any;
    leafletState.map = m;
    return m;
  };
  const marker = (ll: any) => {
    const e = evented();
    const mk = { ...e, ll, addTo: () => mk, setLatLng: (x: any) => (mk.ll = x), getLatLng: () => ({ lat: mk.ll[0], lng: mk.ll[1] }) };
    mk.on = (ev: string, fn: any) => ((e.h[ev] = fn), mk) as any;
    leafletState.marker = mk;
    return mk;
  };
  const circle = (ll: any, o: any) => {
    const c = { ll, radius: o.radius, addTo: () => c, setLatLng: (x: any) => (c.ll = x), setRadius: (r: number) => (c.radius = r) };
    leafletState.circle = c;
    return c;
  };
  const tileLayer = (url: string) => ((leafletState.tileUrl = url), { addTo: () => undefined });
  return { default: { map, marker, circle, tileLayer } };
});
vi.mock('leaflet/dist/leaflet.css', () => ({}));

function setup(fields: FieldDef[], initial: Record<string, unknown> = {}) {
  const values = ref<Record<string, unknown>>(initial);
  const Host = defineComponent(() => () =>
    h(MrcForm, { modelValue: values.value, 'onUpdate:modelValue': (v: Record<string, unknown>) => (values.value = v), fields }),
  );
  const w = mount(Host, { attachTo: document.body });
  return { w, values };
}
const settle = async () => {
  await flushPromises();
  await new Promise((r) => setTimeout(r, 0));
  await flushPromises();
};

// Muat mock lebih dulu: import() paralel pertama kali ke modul yang di-mock bisa lolos ke modul asli.
beforeAll(async () => {
  await import('leaflet');
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('field.editor (Quill)', () => {
  const quillOf = (w: ReturnType<typeof setup>['w'], i = 0) => Quill.find(w.findAll('.mrcatz-editor .ql-container')[i]!.element) as Quill;

  it('memuat Quill, menyinkronkan HTML, dan menormalkan dokumen kosong', async () => {
    const { w, values } = setup([field.editor('isi', 'Isi', { placeholder: 'Tulis...' })], { isi: '<p>awal</p>' });
    await settle();
    const q = quillOf(w);
    expect(q.root.dataset.placeholder).toBe('Tulis...');
    // Toolbar sama dengan Laravel: H2–H4, B/I/U/S, warna, list, blockquote/link/image, clean.
    expect(w.findAll('.ql-toolbar .ql-header option').map((o) => o.attributes('value') ?? '')).toEqual(['2', '3', '4', '']);
    expect(w.find('.ql-toolbar button.ql-image').exists()).toBe(true);
    expect(q.root.innerHTML).toBe('<p>awal</p>');
    q.setText('baru\n');
    expect(values.value.isi).toBe('<p>baru</p>');
    q.setText('');
    expect(values.value.isi).toBe('');
    // Nilai dari luar memperbarui editor.
    values.value = { isi: '<h2>reset</h2>' };
    await nextTick();
    expect(q.root.innerHTML).toBe('<h2>reset</h2>');
    expect(document.getElementById('mrcatz-editor-style')).not.toBeNull();
  });

  it('upload: tombol gambar memanggil `upload` lalu menyisipkan URL', async () => {
    const upload = vi.fn(async () => 'https://cdn.test/a.png');
    const { w, values } = setup([field.editor('isi', 'Isi', { upload })]);
    await settle();
    const created: HTMLInputElement[] = [];
    const orig = document.createElement.bind(document);
    const spy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
      const el = orig(tag);
      if (tag === 'input') {
        created.push(el as HTMLInputElement);
        (el as HTMLInputElement).click = () => {};
      }
      return el;
    }) as typeof document.createElement);
    await w.find('.ql-toolbar button.ql-image').trigger('click');
    spy.mockRestore();
    const input = created.at(-1)!;
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'a.png', { type: 'image/png' })] });
    await input.onchange!(new Event('change'));
    await settle();
    expect(upload).toHaveBeenCalled();
    expect(values.value.isi).toContain('<img src="https://cdn.test/a.png">');
  });

  it('disabled → readOnly', async () => {
    const { w } = setup([field.editor('isi', 'Isi', { disabled: true })]);
    await settle();
    expect(quillOf(w).isEnabled()).toBe(false);
  });
});

describe('field.editorAdvanced (TinyMCE)', () => {
  it('memakai window.tinymce, opsi seperti Laravel, dan sinkron dua arah', async () => {
    let content = '';
    const handlers: Record<string, () => void> = {};
    const editor = {
      ui: { registry: { addButton: vi.fn() } },
      translate: (s: string) => s,
      on: (evs: string, fn: () => void) => evs.split(' ').forEach((e) => (handlers[e] = fn)),
      getContent: () => content,
      setContent: (v: string) => (content = v),
      mode: { set: vi.fn() },
    };
    const init = vi.fn(async (opts: any) => {
      opts.setup(editor);
      handlers.init?.();
      return [editor];
    });
    (window as any).tinymce = { init, remove: vi.fn() };
    const { values } = setup([field.editorAdvanced('isi', 'Isi', { editorOptions: { height: 300 } })], { isi: '<p>awal</p>' });
    await settle();
    const opts = init.mock.calls[0]![0];
    expect(opts).toMatchObject({ license_key: 'gpl', base_url: 'https://cdn.jsdelivr.net/npm/tinymce@7', height: 300, branding: false });
    expect(opts.toolbar).toContain('mrcatzimage');
    expect(editor.ui.registry.addButton).toHaveBeenCalledWith('mrcatzimage', expect.any(Object));
    expect(content).toBe('<p>awal</p>');
    content = '<p>diketik</p>';
    handlers.keyup!();
    expect(values.value.isi).toBe('<p>diketik</p>');
    values.value = { isi: '<p>luar</p>' };
    await nextTick();
    expect(content).toBe('<p>luar</p>');
    delete (window as any).tinymce;
  });
});

describe('field.map (Leaflet)', () => {
  it('mengisi titik awal, klik peta memindahkan marker, radius & input manual', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { w, values } = setup([field.map('loc', 'Lokasi', { center: { lat: 1, lng: 2 }, zoom: 10, radius: { default: 100, min: 10, max: 1000 }, theme: 'dark', height: 200 })]);
    await settle();
    expect(leafletState.map.view).toEqual({ ll: [1, 2], zoom: 10 });
    expect(leafletState.tileUrl).toContain('dark_all');
    expect(leafletState.circle.radius).toBe(100);
    // Seperti Laravel, nilai kosong diisi titik awal.
    expect(values.value.loc).toEqual({ lat: 1, lng: 2, radius: 100 });
    expect((w.find('.mrcatz-map').element as HTMLElement).style.height).toBe('200px');

    leafletState.map.h.click({ latlng: { lat: 3.5, lng: 4.5 } });
    await nextTick();
    expect(values.value.loc).toEqual({ lat: 3.5, lng: 4.5, radius: 100 });
    expect(leafletState.marker.ll).toEqual([3.5, 4.5]);
    expect(w.find('.mrcatz-map-coords').text()).toBe('3.50000, 4.50000');

    await w.find('[data-part="radius"]').setValue('250');
    expect(values.value.loc).toEqual({ lat: 3.5, lng: 4.5, radius: 250 });
    expect(leafletState.circle.radius).toBe(250);

    await w.find('[data-part="toggle"]').trigger('click');
    await w.find('[data-part="lat"]').setValue('-7');
    expect((values.value.loc as { lat: number }).lat).toBe(3.5); // debounce 400 ms
    vi.advanceTimersByTime(400);
    await nextTick();
    expect(values.value.loc).toEqual({ lat: -7, lng: 4.5, radius: 250 });
    expect(leafletState.marker.ll).toEqual([-7, 4.5]);

    await w.find('[data-part="clear"]').trigger('click');
    expect(values.value.loc).toEqual({ lat: 1, lng: 2, radius: 250 });
    w.unmount();
    expect(leafletState.map.remove).toHaveBeenCalled();
  });

  it('tanpa radius nilai hanya { lat, lng }', async () => {
    const { values, w } = setup([field.map('loc', 'Lokasi')], { loc: { lat: -6.9, lng: 107.6 } });
    await settle();
    expect(values.value.loc).toEqual({ lat: -6.9, lng: 107.6 });
    expect(leafletState.map.view.ll).toEqual([-6.9, 107.6]);
    expect(w.find('[data-part="radius"]').exists()).toBe(false);
  });
});
