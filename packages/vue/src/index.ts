import type { App } from 'vue';
import { createContext, MRCATZ_KEY, type MrcatzOptions } from './config';
import MrcDataTable from './components/MrcDataTable.vue';
import MrcCrudTable from './components/MrcCrudTable.vue';
import MrcForm from './components/form/MrcForm.vue';
import MrcFormField from './components/form/MrcFormField.vue';
import MrcModal from './components/MrcModal.vue';
import MrcConfirm from './components/MrcConfirm.vue';
import MrcCombobox from './components/MrcCombobox.vue';
import MrcPopover from './components/MrcPopover.vue';
import MrcHighlight from './components/MrcHighlight.vue';
import MrcIcon from './components/MrcIcon.vue';
import MrcToaster from './components/MrcToaster.vue';
import MrcExpandFields from './components/MrcExpandFields.vue';
import MrcImage from './components/table/MrcImage.vue';
import MrcBreadcrumbs from './components/MrcBreadcrumbs.vue';
import MrcFormPage from './components/form/MrcFormPage.vue';

export {
  MrcDataTable,
  MrcCrudTable,
  MrcForm,
  MrcFormField,
  MrcModal,
  MrcConfirm,
  MrcCombobox,
  MrcPopover,
  MrcHighlight,
  MrcIcon,
  MrcToaster,
  MrcExpandFields,
  MrcImage,
  MrcBreadcrumbs,
  MrcFormPage,
};

export const components = {
  MrcDataTable,
  MrcCrudTable,
  MrcForm,
  MrcModal,
  MrcConfirm,
  MrcCombobox,
  MrcHighlight,
  MrcIcon,
  MrcToaster,
  MrcExpandFields,
  MrcImage,
  MrcBreadcrumbs,
  MrcFormPage,
};

/**
 * Plugin Vue: menyediakan konfigurasi dan (opsional) mendaftarkan komponen global.
 *
 * @example
 * app.use(VueQueryPlugin).use(createMrcatz({ locale: 'id', notify: (type, msg) => toast[type](msg) }))
 */
export function createMrcatz(opts: MrcatzOptions & { registerComponents?: boolean } = {}) {
  const ctx = createContext(opts);
  return {
    install(app: App) {
      app.provide(MRCATZ_KEY, ctx);
      if (opts.registerComponents !== false) {
        for (const [name, comp] of Object.entries(components)) app.component(name, comp);
      }
    },
  };
}

export { useMrcatz, pushToast, openLightbox, MRCATZ_KEY, type MrcatzOptions, type NotifyFn, type NotifyType, type IconOptions, type CustomIcon } from './config';
export { id as messagesId, en as messagesEn, type Messages, type MessageKey } from './i18n';
export { col, TONE_BTN, cellValue, displayValue, type ColumnDef, type CellContext, type Tone, type RowAction, type ActionsConfig, type InlineEditConfig } from './columns';
export { field, initialValues, isVisible, type FieldDef, type FieldType, type FieldOption, type FormValues, type CrudMode, type FieldActionContext, type HintTone } from './fields';
export type { BreadcrumbItem } from './types';
export { bulkAction, type BulkAction } from './bulk';
export type { ExpandField } from './expand';
export { httpSource, memorySource, staticFilters, unwrapPage, type DataSource, type Fetcher, type HttpSourceOptions } from './sources';
export { useDataTable, type DataTableController, type UseDataTableOptions, type PaginationMode } from './composables/useDataTable';
export { MrcFormError, validateFields, errorMessage, type FormErrors, type StandardSchema } from './validation';
export { buildExportTable, downloadCsv, printTable, type ExportFormat, type ExportScope } from './export';
export { isBuiltinIcon, type IconName, type BuiltinIcon, type IconSet } from './icons';
// Re-export dari core agar halaman cukup mengimpor satu paket.
export { filter, highlight, type FilterDefinition, type FilterSchema, type TableQuery, type TablePage, type SortRule } from '@mrcatz/datatable-core';
