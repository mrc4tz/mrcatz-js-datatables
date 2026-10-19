export interface Laporan {
  id: number;
  nomor: string;
  judul: string;
  pelapor: string;
  email: string;
  kecamatan: string;
  kategoriId: number;
  kategori: { id: number; nama: string };
  status: 'baru' | 'diproses' | 'selesai' | 'ditolak';
  prioritas: number;
  createdAt: string;
  foto: string | null;
}

export const KECAMATAN = [
  'Tanjung', 'Murung Pudak', 'Kelua', 'Tanta', 'Haruai', 'Upau',
  'Muara Uya', 'Jaro', 'Bintang Ara', 'Banua Lawas', 'Pugaan', 'Muara Harus',
].map((k) => ({ value: k, label: k }));

export const KATEGORI = [
  { id: 1, nama: 'Infrastruktur' },
  { id: 2, nama: 'Kesehatan' },
  { id: 3, nama: 'Pendidikan' },
  { id: 4, nama: 'Kebersihan' },
  { id: 5, nama: 'Administrasi Kependudukan' },
  { id: 6, nama: 'Air Bersih' },
  { id: 7, nama: 'Penerangan Jalan' },
];

export const STATUS = [
  { value: 'baru', label: 'Baru' },
  { value: 'diproses', label: 'Diproses' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'ditolak', label: 'Ditolak' },
];

const NAMA = ['Budi Santoso', 'Siti Aminah', 'Ahmad Fauzi', 'Rina Marlina', 'Dedi Kurniawan', 'Nur Hidayah', 'Rahmat Hidayat', 'Fitri Handayani', 'Agus Salim', 'Dewi Lestari', 'Muhammad Rizky', 'Yuliana Sari'];
const JUDUL = [
  'Jalan berlubang di depan sekolah',
  'Lampu jalan padam sejak seminggu',
  'Antrian puskesmas terlalu panjang',
  'Sampah menumpuk di pasar',
  'Air PDAM keruh dan berbau',
  'KTP elektronik belum jadi',
  'Drainase tersumbat saat hujan',
  'Guru honorer belum menerima gaji',
  'Jembatan kayu mulai lapuk',
  'Pelayanan kantor desa lambat',
];

/** PRNG deterministik agar data contoh sama di setiap muat. */
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

export function makeLaporan(n = 137): Laporan[] {
  const r = rng(42);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
  const start = new Date('2026-01-01T08:00:00+08:00').getTime();
  return Array.from({ length: n }, (_, i) => {
    const kat = pick(KATEGORI);
    const nama = pick(NAMA);
    return {
      id: i + 1,
      nomor: `HT-2026-${String(i + 1).padStart(4, '0')}`,
      judul: pick(JUDUL),
      pelapor: nama,
      email: `${nama.toLowerCase().replace(/\s+/g, '.')}@mail.id`,
      kecamatan: pick(KECAMATAN).value,
      kategoriId: kat.id,
      kategori: kat,
      status: pick(STATUS).value as Laporan['status'],
      prioritas: 1 + Math.floor(r() * 5),
      createdAt: new Date(start + Math.floor(r() * 290) * 86_400_000).toISOString(),
      foto: r() > 0.5 ? `https://picsum.photos/seed/ht${i}/200` : null,
    };
  });
}
