// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createMrcatz, MrcIcon, type IconOptions } from '../src';

const render = (name: string, icons?: IconOptions) =>
  mount(MrcIcon, { props: { name }, global: { plugins: [createMrcatz({ icons, registerComponents: false })] } });

describe('MrcIcon', () => {
  it('default: SVG bawaan, nama asing → font Material', () => {
    expect(render('add').find('svg').exists()).toBe(true);
    expect(render('manage_accounts').find('span.material-symbols-outlined').text()).toBe('manage_accounts');
  });

  it('material: semua ikon jadi font, alias dipetakan', () => {
    const w = render('pencil', { set: 'material', materialClass: 'material-icons' });
    expect(w.find('span.material-icons').text()).toBe('edit');
    expect(w.find('svg').exists()).toBe(false);
  });

  it('fontawesome: kelas FA6', () => {
    expect(render('delete', { set: 'fontawesome' }).find('i').classes()).toContain('fa-trash');
    expect(render('user_check', { set: 'fontawesome' }).find('i').classes()).toContain('fa-user-check');
  });

  it('custom: path dibungkus svg, HTML apa adanya, sisanya bawaan', () => {
    const custom = { add: '<path d="M0 0"/>', search: '<i class="bi bi-search"></i>' };
    expect(render('add', { set: 'custom', custom }).find('svg path').attributes('d')).toBe('M0 0');
    expect(render('search', { set: 'custom', custom }).find('i.bi-search').exists()).toBe(true);
    expect(render('close', { set: 'custom', custom }).find('svg').exists()).toBe(true);
  });

  it('nama berupa HTML langsung dirender', () => {
    expect(render('<i class="bi bi-star"></i>').find('i.bi-star').exists()).toBe(true);
  });
});
