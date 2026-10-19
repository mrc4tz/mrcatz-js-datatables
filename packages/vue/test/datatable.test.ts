// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { filter } from '@mrcatz/datatable-core';
import { MrcDataTable, col, createMrcatz, memorySource } from '../src';

const rows = [
  { id: 1, nama: 'Budi Santoso', status: 'aktif' },
  { id: 2, nama: 'Siti Aminah', status: 'nonaktif' },
  { id: 3, nama: 'Budi Hartono', status: 'aktif' },
];

function setup(props: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return mount(MrcDataTable as never, {
    props: {
      name: 't',
      syncUrl: false,
      source: memorySource(rows, {
        search: { columns: ['nama'] },
        filters: [filter.select('status', 'Status', { field: 'status', options: [{ value: 'aktif', label: 'Aktif' }] })],
      }),
      columns: [col.rowNumber(), col.text('nama', 'Nama'), col.actions()],
      ...props,
    },
    global: { plugins: [[VueQueryPlugin, { queryClient }], createMrcatz({ registerComponents: false })] },
    attachTo: document.body,
  });
}

const bodyRows = (w: ReturnType<typeof setup>) => w.findAll('tbody tr[data-row]');
const tick = async () => {
  await flushPromises();
  await new Promise((r) => setTimeout(r, 0));
  await flushPromises();
};

describe('MrcDataTable', () => {
  it('merender baris dan nomor urut', async () => {
    const w = setup();
    await tick();
    expect(bodyRows(w)).toHaveLength(3);
    expect(bodyRows(w)[0]!.text()).toContain('1');
    w.unmount();
  });

  it('pencarian men-highlight kata kunci tanpa HTML mentah', async () => {
    const w = setup({ searchMode: 'submit' });
    await tick();
    // Toolbar desktop (form kedua; yang pertama milik toolbar mobile).
    const form = w.findAll('form')[1]!;
    await form.find('input[type="text"]').setValue('hartono');
    await form.trigger('submit');
    await tick();
    expect(bodyRows(w)).toHaveLength(1);
    expect(w.find('tbody .mrcatz-search-highlight').text()).toBe('Hartono');
    w.unmount();
  });

  it('memanggil handler edit & delete dari kolom aksi', async () => {
    const edited: unknown[] = [];
    const deleted: unknown[] = [];
    const w = setup({ onEdit: (r: unknown) => edited.push(r), onDelete: (r: unknown) => deleted.push(r) });
    await tick();
    await bodyRows(w)[0]!.find('button[aria-label="Edit"]').trigger('click');
    await bodyRows(w)[1]!.find('button[aria-label="Hapus"]').trigger('click');
    expect(edited).toHaveLength(1);
    expect(deleted).toHaveLength(1);
    w.unmount();
  });

  it('klik header mengurutkan desc lalu asc (sama dengan versi Laravel)', async () => {
    const w = setup();
    await tick();
    const th = w.findAll('thead th').find((t) => t.text().startsWith('Nama'))!;
    await th.find('button').trigger('click');
    await tick();
    expect(bodyRows(w)[0]!.text()).toContain('Siti Aminah');
    expect(th.attributes('aria-sort')).toBe('descending');
    await th.find('button').trigger('click');
    await tick();
    expect(bodyRows(w)[0]!.text()).toContain('Budi Hartono');
    expect(th.attributes('aria-sort')).toBe('ascending');
    w.unmount();
  });

  it('tombol Pilih menyalakan/mematikan mode seleksi dan mengosongkan pilihan', async () => {
    const w = setup({ selectable: true, selectionToggle: true });
    await tick();
    const rowBoxes = () => w.findAll('tbody tr[data-row] input[type="checkbox"]');
    expect(rowBoxes()).toHaveLength(0);

    const toggle = w.find('button[aria-label="Pilih"]');
    await toggle.trigger('click');
    expect(toggle.attributes('aria-pressed')).toBe('true');
    expect(rowBoxes()).toHaveLength(3);

    await rowBoxes()[0]!.setValue(true);
    expect(w.text()).toContain('1 data dipilih');

    await toggle.trigger('click');
    expect(rowBoxes()).toHaveLength(0);
    expect(w.text()).not.toContain('data dipilih');
    w.unmount();
  });
});
