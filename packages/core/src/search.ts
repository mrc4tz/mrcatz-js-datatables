/** Pecah kata kunci pencarian menjadi kata-kata unik (spasi ganda diabaikan). */
export function splitKeywords(search: string | null | undefined): string[] {
  if (!search) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of search.trim().split(/\s+/u)) {
    const lower = word.toLowerCase();
    if (word && !seen.has(lower)) {
      seen.add(lower);
      out.push(word);
    }
  }
  return out;
}

/**
 * N-gram karakter unik (default 3) untuk toleransi salah ketik.
 * Kata yang lebih pendek dari ukuran gram menghasilkan array kosong.
 */
export function trigrams(word: string, size = 3): string[] {
  const chars = [...word.toLowerCase()];
  if (chars.length < size) return [];
  const grams = new Set<string>();
  for (let i = 0; i <= chars.length - size; i++) grams.add(chars.slice(i, i + size).join(''));
  return [...grams];
}

export interface HighlightSegment {
  text: string;
  match: boolean;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tandai bagian teks yang cocok dengan kata kunci — tanpa HTML, jadi aman
 * dari XSS; komponen yang merender segmen menjadi `<mark>`.
 *
 * Pencocokan tidak peka huruf besar/kecil, tapi teks asli dipertahankan:
 * mencari "cob" pada "Coba" menghasilkan [{Cob, match}, {a}].
 * Kata kunci yang tumpang tindih digabung (tidak ada highlight ganda).
 */
export function highlight(text: unknown, search: string | string[]): HighlightSegment[] {
  const value = text === null || text === undefined ? '' : String(text);
  const words = (Array.isArray(search) ? search : splitKeywords(search)).filter(Boolean);
  if (!value || words.length === 0) return value ? [{ text: value, match: false }] : [];

  // Kata terpanjang dulu agar "budi santoso" menang atas "budi".
  const pattern = new RegExp(
    words
      .slice()
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp)
      .join('|'),
    'giu',
  );

  const segments: HighlightSegment[] = [];
  let last = 0;
  for (const m of value.matchAll(pattern)) {
    const start = m.index ?? 0;
    if (m[0].length === 0) continue;
    if (start > last) segments.push({ text: value.slice(last, start), match: false });
    const prev = segments[segments.length - 1];
    if (prev?.match && start === last) prev.text += m[0];
    else segments.push({ text: m[0], match: true });
    last = start + m[0].length;
  }
  if (last < value.length) segments.push({ text: value.slice(last), match: false });
  return segments;
}
