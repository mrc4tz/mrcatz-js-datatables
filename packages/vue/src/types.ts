/** Satu tingkat breadcrumb; tanpa `to` berarti halaman aktif. */
export interface BreadcrumbItem {
  title: string;
  to?: string | null;
}
