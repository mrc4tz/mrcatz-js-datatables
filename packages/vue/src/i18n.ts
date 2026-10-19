export const id = {
  action: { add: 'Tambah', save: 'Simpan', cancel: 'Batal', delete: 'Hapus', edit: 'Edit', reset: 'Reset', export: 'Export', apply: 'Terapkan', clear: 'Hapus', close: 'Tutup', more: 'Lainnya', details: 'Detail', yesReset: 'Ya, Reset', yesDelete: 'Ya, Hapus', refresh: 'Muat ulang', loadMore: 'Muat lebih banyak' },
  column: { actions: 'Aksi', rowNumber: 'No', toggle: 'Kolom', resetLayout: 'Reset tata letak', dragHint: 'Seret untuk mengubah urutan' },
  search: { placeholder: 'Cari data...', submit: 'Cari' },
  filter: {
    button: 'Filter',
    all: 'Semua',
    active: '{count} filter aktif',
    none: 'Tidak ada filter untuk tabel ini',
    choose: 'Pilih...',
    searchOption: 'Cari opsi...',
    noMatch: 'Tidak ada opsi cocok untuk "{query}"',
    selected: '{count} / {total} terpilih',
    selectAll: 'Pilih semua',
    clearSelection: 'Hapus pilihan',
    include: 'Termasuk',
    exclude: 'Kecuali',
    notPrefix: 'Kecuali: ',
    plusMore: '+{count} lagi',
    from: 'Dari',
    to: 'Sampai',
    pickRange: 'Pilih rentang',
    today: 'Hari ini',
    yesterday: 'Kemarin',
    last7: '7 hari terakhir',
    last30: '30 hari terakhir',
    thisMonth: 'Bulan ini',
    thisYear: 'Tahun ini',
    presets: 'Preset filter',
    noPresets: 'Belum ada preset tersimpan',
    presetName: 'Nama preset...',
    savePreset: 'Simpan preset',
  },
  empty: {
    searchTitle: 'Tidak ada hasil untuk "{query}"',
    title: 'Tidak ada hasil ditemukan',
    searchHint: 'Coba ubah kata kunci atau filter pencarian',
    filterHint: 'Coba ubah filter yang sedang aktif',
    noData: 'Belum ada data',
    noDataHint: 'Data akan muncul di sini setelah ditambahkan',
  },
  pagination: { perPage: 'Baris per halaman', range: '{from}–{to} dari {total}', showing: 'Menampilkan {count} dari {total} baris', page: 'Halaman {page}', prev: 'Sebelumnya', next: 'Berikutnya' },
  bulk: { selected: '{count} data dipilih', clear: 'Batalkan pilihan', deleteTitle: 'Hapus {count} data terpilih?', deleteDesc: 'Data yang dipilih akan dihapus secara permanen.', selectRow: 'Pilih baris', selectPage: 'Pilih semua di halaman ini' },
  confirm: { deleteTitle: 'Konfirmasi Hapus', deleteText: 'Apakah Anda yakin ingin menghapus data berikut?', resetTitle: 'Reset pencarian & filter?', resetDesc: 'Semua kata kunci, filter, urutan, dan tata letak kolom akan dikembalikan ke bawaan.' },
  export: {
    title: 'Export Data',
    format: 'Format',
    csv: 'CSV (Excel)',
    pdf: 'PDF / Cetak',
    scope: 'Cakupan data',
    filtered: 'Sesuai filter',
    filteredDesc: 'Pencarian & filter aktif',
    all: 'Semua data',
    allDesc: 'Tanpa filter',
    selected: 'Terpilih',
    selectedDesc: '{count} baris dipilih',
    count: '{count} baris akan diekspor',
    includeConditions: 'Sertakan kondisi aktif di file',
    processing: 'Menyiapkan file...',
    hiddenColumns: '{count} kolom tersembunyi tidak ikut diekspor',
    conditions: 'Kondisi aktif',
    sort: 'Urutan',
    exportedAt: 'Diekspor',
  },
  crud: {
    addTitle: 'Tambah {entity}',
    editTitle: 'Edit {entity}',
    created: '{entity} berhasil ditambahkan',
    updated: '{entity} berhasil diperbarui',
    deleted: '{entity} berhasil dihapus',
    bulkDeleted: '{count} {entity} berhasil dihapus',
    failed: 'Gagal memproses data',
    saved: 'Perubahan disimpan',
  },
  form: { required: '{label} wajib diisi', invalidEmail: 'Format email tidak valid', invalidUrl: 'Format URL tidak valid', min: '{label} minimal {min}', max: '{label} maksimal {max}', minLength: '{label} minimal {min} karakter', confirmMismatch: 'Konfirmasi tidak cocok', confirmLabel: 'Konfirmasi {label}', showPassword: 'Tampilkan', hidePassword: 'Sembunyikan', generate: 'Buat acak', addTag: 'Ketik lalu Enter', choose: 'Pilih...', noOptions: 'Tidak ada opsi' },
  inline: { hint: 'Klik dua kali untuk edit', hintMobile: 'Ketuk untuk edit', saving: 'Menyimpan...' },
  keyboard: { navigate: 'navigasi', edit: 'edit', delete: 'hapus', select: 'pilih', cancel: 'batal' },
  loading: 'Memuat data...',
  error: 'Gagal memuat data',
  retry: 'Coba lagi',
};

export type Messages = typeof id;

export const en: Messages = {
  action: { add: 'Add', save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', reset: 'Reset', export: 'Export', apply: 'Apply', clear: 'Clear', close: 'Close', more: 'More', details: 'Details', yesReset: 'Yes, reset', yesDelete: 'Yes, delete', refresh: 'Reload', loadMore: 'Load more' },
  column: { actions: 'Actions', rowNumber: 'No', toggle: 'Columns', resetLayout: 'Reset layout', dragHint: 'Drag to reorder' },
  search: { placeholder: 'Search...', submit: 'Search' },
  filter: {
    button: 'Filter',
    all: 'All',
    active: '{count} active filters',
    none: 'No filters available for this table',
    choose: 'Choose...',
    searchOption: 'Search options...',
    noMatch: 'No options match "{query}"',
    selected: '{count} / {total} selected',
    selectAll: 'Select all',
    clearSelection: 'Clear selection',
    include: 'Include',
    exclude: 'Exclude',
    notPrefix: 'Not: ',
    plusMore: '+{count} more',
    from: 'From',
    to: 'To',
    pickRange: 'Pick a range',
    today: 'Today',
    yesterday: 'Yesterday',
    last7: 'Last 7 days',
    last30: 'Last 30 days',
    thisMonth: 'This month',
    thisYear: 'This year',
    presets: 'Filter presets',
    noPresets: 'No saved presets yet',
    presetName: 'Preset name...',
    savePreset: 'Save preset',
  },
  empty: {
    searchTitle: 'No results for "{query}"',
    title: 'No results found',
    searchHint: 'Try different keywords or filters',
    filterHint: 'Try changing the active filters',
    noData: 'No data yet',
    noDataHint: 'Data will show up here once added',
  },
  pagination: { perPage: 'Rows per page', range: '{from}–{to} of {total}', showing: 'Showing {count} of {total} rows', page: 'Page {page}', prev: 'Previous', next: 'Next' },
  bulk: { selected: '{count} selected', clear: 'Clear selection', deleteTitle: 'Delete {count} selected rows?', deleteDesc: 'Selected rows will be permanently deleted.', selectRow: 'Select row', selectPage: 'Select all on this page' },
  confirm: { deleteTitle: 'Confirm delete', deleteText: 'Are you sure you want to delete this item?', resetTitle: 'Reset search & filters?', resetDesc: 'Keywords, filters, sorting and column layout will be restored to defaults.' },
  export: {
    title: 'Export data',
    format: 'Format',
    csv: 'CSV (Excel)',
    pdf: 'PDF / Print',
    scope: 'Scope',
    filtered: 'Filtered',
    filteredDesc: 'Active search & filters',
    all: 'All data',
    allDesc: 'Without filters',
    selected: 'Selected',
    selectedDesc: '{count} rows selected',
    count: '{count} rows will be exported',
    includeConditions: 'Include active conditions in file',
    processing: 'Preparing file...',
    hiddenColumns: '{count} hidden columns will not be exported',
    conditions: 'Active conditions',
    sort: 'Sort',
    exportedAt: 'Exported',
  },
  crud: {
    addTitle: 'Add {entity}',
    editTitle: 'Edit {entity}',
    created: '{entity} created',
    updated: '{entity} updated',
    deleted: '{entity} deleted',
    bulkDeleted: '{count} {entity} deleted',
    failed: 'Failed to process data',
    saved: 'Changes saved',
  },
  form: { required: '{label} is required', invalidEmail: 'Invalid email address', invalidUrl: 'Invalid URL', min: '{label} must be at least {min}', max: '{label} must be at most {max}', minLength: '{label} must be at least {min} characters', confirmMismatch: 'Confirmation does not match', confirmLabel: 'Confirm {label}', showPassword: 'Show', hidePassword: 'Hide', generate: 'Generate', addTag: 'Type and press Enter', choose: 'Choose...', noOptions: 'No options' },
  inline: { hint: 'Double-click to edit', hintMobile: 'Tap to edit', saving: 'Saving...' },
  keyboard: { navigate: 'navigate', edit: 'edit', delete: 'delete', select: 'select', cancel: 'cancel' },
  loading: 'Loading data...',
  error: 'Failed to load data',
  retry: 'Try again',
};

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = { [K in keyof T]: T[K] extends string ? K : Join<K, Paths<T[K]>> }[keyof T];
export type MessageKey = Paths<Messages>;

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };

export function mergeMessages(base: Messages, override?: DeepPartial<Messages>): Messages {
  if (!override) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    const cur = (base as Record<string, unknown>)[k];
    out[k] = typeof v === 'object' && v && typeof cur === 'object' ? mergeMessages(cur as Messages, v as never) : v;
  }
  return out as Messages;
}

export function translate(messages: Messages, key: MessageKey, params?: Record<string, unknown>): string {
  const raw = key.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], messages);
  const text = typeof raw === 'string' ? raw : key;
  return params ? text.replace(/\{(\w+)\}/g, (_, p: string) => String(params[p] ?? '')) : text;
}
