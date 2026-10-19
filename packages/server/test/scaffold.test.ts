import { describe, expect, it } from 'vitest';
import { planScaffold } from '../src/scaffold';

describe('planScaffold (mrcatz make)', () => {
  it('menghasilkan file Nest + halaman Nuxt dengan nama yang benar', () => {
    const files = planScaffold({ name: 'OrderItem', path: 'admin' });
    expect(files.map((f) => f.path)).toEqual([
      'apps/api/src/admin/order-item/order-item.table.ts',
      'apps/api/src/admin/order-item/order-item.controller.ts',
      'apps/api/src/admin/order-item/order-item.module.ts',
      'apps/web/app/pages/admin/order-items.vue',
    ]);
    const [table, controller, , page] = files;
    expect(table!.content).toContain('model: prisma.orderItem');
    expect(table!.content).toContain("from '../../prisma/prisma.service'");
    expect(controller!.content).toContain("@Controller('admin/order-items')");
    expect(page!.content).toContain("url: '/api/admin/order-items'");
    expect(page!.content).toContain('entity="Order item"');
  });

  it('opsi model/table/no-web dan nama tidak valid', () => {
    const files = planScaffold({ name: 'category', model: 'kategori', table: 'kategori', webDir: false, apiDir: 'src' });
    expect(files).toHaveLength(3);
    expect(files[0]!.path).toBe('src/category/category.table.ts');
    expect(files[0]!.content).toContain('prisma.kategori');
    expect(files[0]!.content).toContain("table: 'categories'".replace('categories', 'kategori'));
    expect(() => planScaffold({ name: '../evil' })).toThrow();
  });
});
