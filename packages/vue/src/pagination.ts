/**
 * Deret nomor halaman — sama dengan `UrlWindow` Laravel untuk `onEachSide(1)`:
 *  - < 10 halaman            → semua halaman
 *  - dekat awal (≤ 5)        → 1..6 … n-1 n
 *  - dekat akhir (> n - 5)   → 1 2 … n-5..n
 *  - di tengah               → 1 2 … c-1 c c+1 … n-1 n
 */
export function pageWindow(current: number, last: number, onEachSide = 1): Array<number | '...'> {
  const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
  if (last < onEachSide * 2 + 8) return range(1, last);
  const window = onEachSide + 4;
  const finish = range(last - 1, last);
  const start = range(1, 2);
  if (current <= window) return [...range(1, window + onEachSide), '...', ...finish];
  if (current > last - window) return [...start, '...', ...range(last - (window + (onEachSide - 1)), last)];
  return [...start, '...', ...range(current - onEachSide, current + onEachSide), '...', ...finish];
}
