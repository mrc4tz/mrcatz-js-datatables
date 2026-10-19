/**
 * Pipeline gambar editor rich text (pengganti `config('mrcatz.editor_image')`
 * mode `upload`, `EditorImageUploadController`, `processEditorImages()` dan
 * `php artisan mrcatz:cleanup-editor-images`).
 *
 * Alur sama dengan Laravel:
 *  1. Editor mengunggah gambar → `upload()` menyimpannya di `<path>/tmp/<ulid>.<ext>`.
 *  2. Saat form disimpan → `processHtml(html, oldHtml)` memindahkan gambar tmp
 *     ke `<path>/`, mengganti URL di HTML, dan menghapus gambar yang sudah tidak
 *     dipakai dibanding `oldHtml`.
 *  3. Gambar tmp yang tidak pernah disimpan dihapus oleh `cleanupTmp()` (dipanggil
 *     otomatis di `processHtml`, atau jadwalkan sendiri).
 *
 * Storage bisa diganti (S3, R2, MinIO, ...) dengan mengimplementasikan
 * `EditorImageStorage`; bawaannya `localDiskStorage()` (Node `fs`).
 */

export interface EditorImageStorage {
  put(path: string, data: Uint8Array, contentType?: string): Promise<void>;
  /** `null` bila file tidak ada. */
  get(path: string): Promise<Uint8Array | null>;
  delete(path: string): Promise<void>;
  /** Daftar file langsung di bawah `dir` (tidak rekursif) beserta waktu ubah. */
  list(dir: string): Promise<Array<{ path: string; modified: Date }>>;
  /** URL publik untuk path relatif. */
  url(path: string): string;
}

export interface EditorImagesOptions {
  storage: EditorImageStorage;
  /** Folder gambar permanen. Default `editor-images`; tmp di `<path>/tmp`. */
  path?: string;
  /** Ukuran maksimum dalam KB. Default 2048. */
  maxSize?: number;
  /** Umur file tmp sebelum dihapus `cleanupTmp()`, dalam jam. Default 24. */
  tmpLifetimeHours?: number;
  /** MIME yang diizinkan. Default jpeg/png/gif/webp/avif (SVG sengaja tidak, rawan XSS). */
  mimeTypes?: string[];
}

/** File unggahan — cocok dengan `Express.Multer.File` maupun objek buatan sendiri. */
export interface UploadedImage {
  buffer: Uint8Array;
  mimetype: string;
  originalname?: string;
  size?: number;
}

export class EditorImageError extends Error {
  readonly status = 422;
  constructor(
    message: string,
    readonly code: 'required' | 'not_image' | 'too_large',
  ) {
    super(message);
    this.name = 'EditorImageError';
  }
}

const DEFAULT_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/** ULID sederhana (waktu + acak) — urut berdasarkan waktu seperti `Str::ulid()`. */
function ulid(): string {
  const chars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let t = Date.now();
  let time = '';
  for (let i = 0; i < 10; i++) {
    time = chars[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const rand = crypto.getRandomValues(new Uint8Array(16));
  return time + Array.from(rand, (b) => chars[b % 32]).join('');
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function editorImages(opts: EditorImagesOptions) {
  const { storage } = opts;
  const base = (opts.path ?? 'editor-images').replace(/^\/+|\/+$/g, '');
  const tmp = `${base}/tmp`;
  const maxBytes = (opts.maxSize ?? 2048) * 1024;
  const lifetimeMs = (opts.tmpLifetimeHours ?? 24) * 3_600_000;
  const mimes = opts.mimeTypes ?? DEFAULT_MIMES;
  const baseUrl = storage.url('').replace(/\/+$/, '');

  /** URL publik → path relatif di storage (atau `null` bila bukan milik storage ini). */
  function toPath(url: string): string | null {
    let rel = url;
    if (baseUrl && url.startsWith(baseUrl)) rel = url.slice(baseUrl.length);
    else if (/^[a-z]+:\/\//i.test(url)) return null;
    rel = rel.replace(/^\/+/, '').split(/[?#]/)[0]!;
    return rel || null;
  }

  /** Simpan gambar ke folder tmp. Kembalikan `{ url }` untuk editor. */
  async function upload(file: UploadedImage | null | undefined): Promise<{ url: string; path: string }> {
    if (!file || !file.buffer?.length) throw new EditorImageError('Gambar wajib diunggah.', 'required');
    if (!mimes.includes(file.mimetype)) throw new EditorImageError('File harus berupa gambar.', 'not_image');
    const size = file.size ?? file.buffer.length;
    if (size > maxBytes) {
      throw new EditorImageError(`Ukuran gambar maksimal ${Math.round((maxBytes / 1024 / 1024) * 10) / 10}MB.`, 'too_large');
    }
    const ext = EXT[file.mimetype] ?? file.originalname?.split('.').pop()?.toLowerCase() ?? 'bin';
    const path = `${tmp}/${ulid()}.${ext}`;
    await storage.put(path, file.buffer, file.mimetype);
    return { url: storage.url(path), path };
  }

  /** Hapus file tmp yang lebih tua dari `tmpLifetimeHours`. Kembalikan jumlah yang dihapus. */
  async function cleanupTmp(now = Date.now()): Promise<number> {
    let deleted = 0;
    let items: Array<{ path: string; modified: Date }> = [];
    try {
      items = await storage.list(tmp);
    } catch {
      return 0;
    }
    for (const item of items) {
      if (now - item.modified.getTime() < lifetimeMs) continue;
      try {
        await storage.delete(item.path);
        deleted++;
      } catch {
        // best-effort, coba lagi di pemanggilan berikutnya
      }
    }
    return deleted;
  }

  /**
   * Proses HTML editor sebelum disimpan (pengganti `processEditorImages`):
   * pindahkan gambar tmp ke folder permanen, ganti URL-nya, dan hapus gambar
   * di `oldHtml` yang sudah tidak ada di `html`.
   */
  async function processHtml(html: string, oldHtml?: string | null): Promise<string> {
    if (!html && !oldHtml) return html;
    let out = html ?? '';
    const tmpUrls = new Set(
      [...out.matchAll(/src=["']([^"']+)["']/g)].map((m) => m[1]!).filter((u) => toPath(u)?.startsWith(`${tmp}/`)),
    );
    for (const url of tmpUrls) {
      const from = toPath(url)!;
      const data = await storage.get(from);
      if (!data || !data.length) continue; // sudah dipindah / hilang — biarkan URL apa adanya
      const to = `${base}/${from.slice(tmp.length + 1)}`;
      await storage.put(to, data);
      await storage.delete(from).catch(() => {});
      out = out.replace(new RegExp(escapeRe(url), 'g'), storage.url(to));
    }

    if (oldHtml) {
      for (const m of oldHtml.matchAll(/src=["']([^"']+)["']/g)) {
        const url = m[1]!;
        if (out.includes(url)) continue;
        const path = toPath(url);
        // Hanya hapus file di dalam folder editor (bukan tmp milik orang lain / URL luar).
        if (!path || !path.startsWith(`${base}/`) || path.startsWith(`${tmp}/`)) continue;
        await storage.delete(path).catch(() => {});
      }
    }

    await cleanupTmp();
    return out;
  }

  return { upload, processHtml, cleanupTmp, toPath, options: { path: base, tmpPath: tmp, maxSize: maxBytes / 1024 } };
}

export type EditorImages = ReturnType<typeof editorImages>;

/**
 * Storage disk lokal (Node `fs`), mis. folder yang disajikan statis oleh Nest
 * (`ServeStaticModule`) di `publicUrl`.
 *
 * localDiskStorage({ root: 'uploads', publicUrl: '/uploads' })
 */
export function localDiskStorage(opts: { root: string; publicUrl: string }): EditorImageStorage {
  const fsp = () => import('node:fs/promises');
  const pathMod = () => import('node:path');
  const safe = async (rel: string) => {
    const { resolve, sep } = await pathMod();
    const root = resolve(opts.root);
    const abs = resolve(root, rel);
    if (abs !== root && !abs.startsWith(root + sep)) throw new Error(`Path di luar root: ${rel}`);
    return abs;
  };
  const publicUrl = opts.publicUrl.replace(/\/+$/, '');
  return {
    async put(path, data) {
      const fs = await fsp();
      const { dirname } = await pathMod();
      const abs = await safe(path);
      await fs.mkdir(dirname(abs), { recursive: true });
      await fs.writeFile(abs, data);
    },
    async get(path) {
      const fs = await fsp();
      try {
        return new Uint8Array(await fs.readFile(await safe(path)));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw e;
      }
    },
    async delete(path) {
      const fs = await fsp();
      await fs.rm(await safe(path), { force: true });
    },
    async list(dir) {
      const fs = await fsp();
      const abs = await safe(dir);
      let names: string[] = [];
      try {
        names = await fs.readdir(abs);
      } catch {
        return [];
      }
      const out: Array<{ path: string; modified: Date }> = [];
      for (const name of names) {
        const st = await fs.stat(`${abs}/${name}`);
        if (st.isFile()) out.push({ path: `${dir.replace(/\/+$/, '')}/${name}`, modified: st.mtime });
      }
      return out;
    },
    url(path) {
      return path ? `${publicUrl}/${path.replace(/^\/+/, '')}` : publicUrl;
    },
  };
}
