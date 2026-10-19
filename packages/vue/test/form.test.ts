// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h, nextTick, ref } from 'vue';
import { MrcForm, field, type FieldActionContext } from '../src';

describe('MrcForm', () => {
  it('beberapa perubahan dalam satu tick tidak saling menimpa', async () => {
    let ctx!: FieldActionContext;
    const values = ref<Record<string, unknown>>({ a: '', b: '', c: '' });
    const Host = defineComponent(() => () =>
      h(MrcForm, {
        modelValue: values.value,
        'onUpdate:modelValue': (v: Record<string, unknown>) => (values.value = v),
        fields: [
          field.text('a', 'A'),
          field.text('b', 'B'),
          field.button('Isi', { onClick: (c) => ((ctx = c), c.set('a', '1'), c.set('b', '2'), c.set('c', '3')) }),
        ],
      }),
    );
    const w = mount(Host);
    await w.find('button[type="button"]').trigger('click');
    await nextTick();
    expect(values.value).toMatchObject({ a: '1', b: '2', c: '3' });
    expect(ctx.values).toMatchObject({ a: '1', b: '2', c: '3' });
  });

  it('memecah section card menjadi beberapa kartu', () => {
    const w = mount(MrcForm, {
      props: {
        modelValue: {},
        fields: [field.section('Satu', { card: true }), field.text('x', 'X'), field.section('Dua', { card: true }), field.text('y', 'Y')],
      },
    });
    expect(w.findAll('section.card')).toHaveLength(2);
    expect(w.findAll('.card-title').map((e) => e.text())).toEqual(['Satu', 'Dua']);
  });

  it('validasi wajib & konfirmasi password', async () => {
    const w = mount(MrcForm, {
      props: {
        modelValue: { pw: 'rahasia123', pw_confirmation: 'beda' },
        fields: [field.text('nama', 'Nama', { required: true }), field.password('pw', 'Password', { confirm: true })],
      },
    });
    const ok = await (w.vm as unknown as { validate: () => Promise<boolean> }).validate();
    expect(ok).toBe(false);
    const errs = w.emitted('update:errors')!.at(-1)![0] as Record<string, string>;
    expect(errs.nama).toBe('Nama wajib diisi');
    expect(errs.pw_confirmation).toBe('Konfirmasi tidak cocok');
  });
});
