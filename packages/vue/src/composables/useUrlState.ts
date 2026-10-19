import { getCurrentInstance } from 'vue';
import type { Router } from 'vue-router';

type QueryRecord = Record<string, string | string[]>;

function getRouter(): Router | undefined {
  return getCurrentInstance()?.appContext.config.globalProperties.$router as Router | undefined;
}

function fromLocation(): QueryRecord {
  if (typeof window === 'undefined') return {};
  const out: QueryRecord = {};
  for (const [k, v] of new URLSearchParams(window.location.search)) {
    const cur = out[k];
    out[k] = cur === undefined ? v : Array.isArray(cur) ? [...cur, v] : [cur, v];
  }
  return out;
}

/**
 * Baca/tulis query string halaman. Memakai vue-router bila terpasang (Nuxt),
 * selain itu `history.replaceState`. Hanya kunci milik tabel ini yang disentuh
 * sehingga param lain di URL tetap utuh.
 */
export function useUrlState() {
  const router = getRouter();

  function read(): QueryRecord {
    if (router) {
      const out: QueryRecord = {};
      for (const [k, v] of Object.entries(router.currentRoute.value.query)) {
        if (v === null || v === undefined) continue;
        out[k] = Array.isArray(v) ? (v.filter((x) => x !== null) as string[]) : v;
      }
      return out;
    }
    return fromLocation();
  }

  function write(owned: (key: string) => boolean, next: URLSearchParams) {
    const merged: QueryRecord = {};
    for (const [k, v] of Object.entries(read())) if (!owned(k)) merged[k] = v;
    for (const [k, v] of next) {
      const cur = merged[k];
      merged[k] = cur === undefined ? v : Array.isArray(cur) ? [...cur, v] : [cur, v];
    }

    if (router) {
      void router.replace({ query: merged });
      return;
    }
    if (typeof window === 'undefined') return;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) (Array.isArray(v) ? v : [v]).forEach((x) => qs.append(k, x));
    const s = qs.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${s ? `?${s}` : ''}${window.location.hash}`);
  }

  return { read, write };
}
