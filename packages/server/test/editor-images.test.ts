import { describe, expect, it } from 'vitest';
import { editorImages, EditorImageError, type EditorImageStorage } from '../src/editor-images';

/** Storage di memori untuk tes. */
function memoryStorage() {
  const files = new Map<string, { data: Uint8Array; modified: Date }>();
  const storage: EditorImageStorage = {
    async put(path, data) {
      files.set(path, { data, modified: new Date() });
    },
    async get(path) {
      return files.get(path)?.data ?? null;
    },
    async delete(path) {
      files.delete(path);
    },
    async list(dir) {
      return [...files.entries()]
        .filter(([p]) => p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes('/'))
        .map(([path, f]) => ({ path, modified: f.modified }));
    },
    url: (p) => (p ? `/storage/${p}` : '/storage'),
  };
  return { files, storage };
}

const png = (n = 10) => ({ buffer: new Uint8Array(n).fill(1), mimetype: 'image/png', originalname: 'a.png' });

describe('editorImages', () => {
  it('upload ke tmp, lalu processHtml memindahkan ke permanen', async () => {
    const { files, storage } = memoryStorage();
    const ei = editorImages({ storage });
    const { url } = await ei.upload(png());
    expect(url).toMatch(/^\/storage\/editor-images\/tmp\/[0-9A-Z]{26}\.png$/);

    const html = await ei.processHtml(`<p><img src="${url}"></p>`);
    const finalUrl = url.replace('/tmp/', '/');
    expect(html).toBe(`<p><img src="${finalUrl}"></p>`);
    expect([...files.keys()]).toEqual([finalUrl.replace('/storage/', '')]);
  });

  it('menghapus gambar yang dibuang dari HTML lama, tapi tidak URL luar', async () => {
    const { files, storage } = memoryStorage();
    const ei = editorImages({ storage });
    await storage.put('editor-images/old.png', new Uint8Array(1));
    await storage.put('avatars/x.png', new Uint8Array(1));
    const old = '<img src="/storage/editor-images/old.png"><img src="/storage/avatars/x.png"><img src="https://cdn.x/y.png">';
    await ei.processHtml('<p>kosong</p>', old);
    expect(files.has('editor-images/old.png')).toBe(false);
    expect(files.has('avatars/x.png')).toBe(true);
  });

  it('validasi tipe & ukuran, dan cleanupTmp menghapus file kedaluwarsa', async () => {
    const { files, storage } = memoryStorage();
    const ei = editorImages({ storage, maxSize: 1, tmpLifetimeHours: 1 });
    await expect(ei.upload({ ...png(), mimetype: 'text/plain' })).rejects.toBeInstanceOf(EditorImageError);
    await expect(ei.upload(png(2048))).rejects.toThrow(/maksimal/);
    const { path } = await ei.upload(png(10));
    expect(await ei.cleanupTmp(Date.now())).toBe(0);
    expect(await ei.cleanupTmp(Date.now() + 2 * 3_600_000)).toBe(1);
    expect(files.has(path)).toBe(false);
  });
});
