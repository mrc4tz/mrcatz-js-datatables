// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { h } from 'vue';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { filter } from '@mrc4tz/datatable-core';
import { MrcDataTable, MrcExpandFields, bulkAction, buildXlsx, col, createMrcatz, memorySource, staticFilters } from '../src';
import { presetRangeFor, presetsFor } from '../src/components/filters/dateUtils';

const rows = [
  { id: 1, nama: 'Budi', status: 'aktif', catatan: 'a' },
  { id: 2, nama: 'Siti', status: 'nonaktif', catatan: 'b' },
];

function setup(props: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return mount(MrcDataTable as never, {
    props: { name: 't', syncUrl: false, source: memorySource(rows), columns: [col.text('nama', 'Nama')], ...props },
    global: { plugins: [[VueQueryPlugin, { queryClient }], createMrcatz({ registerComponents: false, notify: () => {} })] },
    attachTo: document.body,
  });
}
const tick = async () => {
  await flushPromises();
  await new Promise((r) => setTimeout(r, 0));
  await flushPromises();
};
const text = (u: Uint8Array) => new TextDecoder().decode(u);

describe('export', () => {
  it('buildXlsx memakai warna export & menulis judul/subjudul', () => {
    const out = text(buildXlsx(['A'], [['x']], { title: 'Laporan', subtitle: 'Q1', colors: { headerBg: '#ff0000', stripe: '00ff00' } }));
    expect(out).toContain('FFFF0000');
    expect(out).toContain('FF00FF00');
    expect(out).toContain('Laporan');
    expect(out).toContain('Q1');
  });
});

describe('filter', () => {
  it('preset rentang mengikuti format', () => {
    const now = new Date(2026, 9, 19);
    expect(presetRangeFor('thisYear', 'month', now)).toEqual({ from: '2026-01', to: '2026-10' });
    expect(presetRangeFor('thisYear', 'year', now)).toEqual({ from: '2026', to: '2026' });
    expect(presetRangeFor('today', 'datetime', now)).toEqual({ from: '2026-10-19T00:00', to: '2026-10-19T23:59' });
    expect(presetsFor('year')).toEqual(['thisYear', 'lastYear']);
  });

  it('staticFilters mempertahankan min/max/dependsOn dan menghitung visible fungsi', () => {
    const [a, b] = staticFilters([
      filter.date('tgl', 'Tanggal', { field: 'tgl', min: '2024-01-01', max: '2024-12-31' }),
      filter.select('kota', 'Kota', { field: 'kota', options: [], dependsOn: 'prov', visible: (c) => !!c.values.prov }),
    ]);
    expect(a).toMatchObject({ min: '2024-01-01', max: '2024-12-31', format: 'date' });
    expect(b).toMatchObject({ dependsOn: ['prov'], visible: false });
  });
});

describe('expand', () => {
  it('field html, custom, baseUrl & target', () => {
    const w = mount(MrcExpandFields, {
      props: {
        row: { id: 1, foto: 'a.png', bio: '<b>Hai</b>' },
        fields: [
          { label: 'Bio', key: 'bio', type: 'html' },
          { label: 'Badge', type: 'custom', render: (r: any) => h('em', `#${r.id}`) },
          { label: 'Foto', key: 'foto', type: 'image', baseUrl: '/cdn' },
          { label: 'Profil', type: 'link', href: () => '/p/1', target: 'profil' },
        ],
      },
      global: { plugins: [createMrcatz({ registerComponents: false, imageBaseUrl: '/uploads' })] },
    });
    expect(w.find('b').text()).toBe('Hai');
    expect(w.find('em').text()).toBe('#1');
    expect(w.find('img').attributes('src')).toBe('/cdn/a.png');
    expect(w.find('a').attributes('target')).toBe('profil');
  });

  it('expandWhen menyembunyikan chevron per baris', async () => {
    const w = setup({ expandable: true, expandFields: [{ label: 'Status', key: 'status' }], expandWhen: (r: any) => r.id === 1 });
    await tick();
    expect(w.findAll('tbody [role="button"][aria-expanded]').length).toBe(1);
    w.unmount();
  });
});

describe('inline edit', () => {
  it('textarea dirender dan parse dipakai sebelum @cell-update', async () => {
    const onCellUpdate = vi.fn();
    const w = setup({
      columns: [col.text('catatan', 'Catatan', { editable: { input: 'textarea', parse: (v: string) => v.toUpperCase() } })],
      onCellUpdate,
    });
    await tick();
    await w.find('[data-inline-edit]').trigger('dblclick');
    const ta = w.find('textarea');
    expect(ta.exists()).toBe(true);
    await ta.setValue('baru');
    await ta.trigger('keydown', { key: 'Enter' });
    await tick();
    expect(onCellUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), 'catatan', 'BARU');
    w.unmount();
  });
});

describe('bulk', () => {
  it('notifikasi sukses aksi massal (pesan dari handler)', async () => {
    const notify = vi.fn();
    const queryClient = new QueryClient();
    const w = mount(MrcDataTable as never, {
      props: {
        name: 'b',
        syncUrl: false,
        source: memorySource(rows),
        columns: [col.text('nama', 'Nama')],
        selectable: true,
        bulkActions: [bulkAction('arsip', 'Arsipkan', { mode: 'instant' })],
        onBulkAction: () => 'Diarsipkan!',
      },
      global: { plugins: [[VueQueryPlugin, { queryClient }], createMrcatz({ registerComponents: false, notify })] },
      attachTo: document.body,
    });
    await tick();
    await w.find('tbody input[type="checkbox"]').setValue(true);
    await tick();
    const btn = w.findAll('button').find((b) => b.text().includes('Arsipkan'));
    await btn!.trigger('click');
    await tick();
    expect(notify).toHaveBeenCalledWith('success', 'Diarsipkan!');
    w.unmount();
  });
});

describe('pagination', () => {
  const many = Array.from({ length: 250 }, (_, i) => ({ id: i + 1, nama: `Orang ${i + 1}` }));
  /** Sumber yang meniru server dengan `maxLimit` 100. */
  const capped = () => {
    const mem = memorySource(many);
    const calls: number[] = [];
    return {
      calls,
      source: { ...mem, key: 'capped', fetch: (q: any) => (calls.push(q.limit), mem.fetch({ ...q, limit: Math.min(q.limit, 100) })) },
    };
  };

  it('load-more menggabungkan halaman (tidak terpotong maxLimit)', async () => {
    const { source, calls } = capped();
    const w = setup({ source, pagination: 'load-more', loadMoreChunk: 100 });
    await tick();
    expect(w.findAll('tbody tr[data-row]').length).toBe(100);
    const more = () => w.findAll('button').find((b) => b.text().includes('Muat'));
    await more()!.trigger('click');
    await tick();
    await more()!.trigger('click');
    await tick();
    expect(w.findAll('tbody tr[data-row]').length).toBe(250);
    expect(more()).toBeUndefined();
    expect(Math.max(...calls)).toBe(100);
    w.unmount();
  });

  it('pagination false memuat semua halaman', async () => {
    const { source } = capped();
    const w = setup({ source, pagination: false });
    await tick();
    expect(w.findAll('tbody tr[data-row]').length).toBe(250);
    w.unmount();
  });

  it('defaultPerPage & loadMoreButton false', async () => {
    const w = setup({ source: memorySource(many), pagination: 'load-more', defaultPerPage: 25, loadMoreButton: false });
    await tick();
    expect(w.findAll('tbody tr[data-row]').length).toBe(25);
    expect(w.findAll('button').some((b) => b.text().includes('Muat'))).toBe(false);
    w.unmount();
  });
});

describe('locale', () => {
  it('setLocale mengganti teks saat runtime', async () => {
    const { createContext } = await import('../src');
    const ctx = createContext({ locale: 'id' });
    const before = ctx.t('action.cancel');
    ctx.setLocale('en');
    expect(ctx.t('action.cancel')).not.toBe(before);
    expect(ctx.dateLocale).toBe('en-US');
  });
});

describe('MrcCrudTable', () => {
  it('form halaman penuh menggantikan tabel + event form-open/form-close', async () => {
    const { MrcCrudTable, field } = await import('../src');
    const queryClient = new QueryClient();
    const events: string[] = [];
    const w = mount(MrcCrudTable as never, {
      props: {
        name: 'c',
        syncUrl: false,
        entity: 'Orang',
        source: memorySource(rows),
        columns: [col.text('nama', 'Nama'), col.actions()],
        fields: [field.text('nama', 'Nama')],
        create: () => {},
        update: () => {},
        formPage: true,
        'onForm-open': (m: string) => events.push(`open:${m}`),
        'onForm-close': (m: string) => events.push(`close:${m}`),
      },
      global: { plugins: [[VueQueryPlugin, { queryClient }], createMrcatz({ registerComponents: false, notify: () => {} })] },
      attachTo: document.body,
    });
    await tick();
    (w.vm as any).openCreate();
    await tick();
    expect(w.find('.mrcatz-form-page').exists()).toBe(true);
    expect(w.find('dialog .mrcatz-form-page').exists()).toBe(false);
    expect(w.find('table').isVisible()).toBe(false);
    await w.find('.mrcatz-form-page button[aria-label]').trigger('click');
    await tick();
    expect(w.find('.mrcatz-form-page').exists()).toBe(false);
    expect(events).toEqual(['open:create', 'close:create']);
    w.unmount();
  });
});

describe('printTable', () => {
  it('printTemplate menimpa tata letak bawaan', async () => {
    const { printTable, escapeHtml } = await import('../src');
    let written = '';
    const fake = { document: { write: (h: string) => (written += h), close: () => {} } };
    const open = vi.spyOn(window, 'open').mockReturnValue(fake as never);
    printTable({ headers: ['Nama'], rows: [['<b>x</b>']] }, 'Judul', {
      template: (t, m) => `<html><body><h1>${m.title}</h1>${t.rows.map((r) => escapeHtml(r[0])).join('')}<i>${m.colors.headerBg}</i></body></html>`,
    });
    expect(written).toContain('<h1>Judul</h1>&lt;b&gt;x&lt;/b&gt;<i>1B3A5C</i>');
    expect(written).toContain('window.print()');
    open.mockRestore();
  });
});
