/**
 * Entry opsional `@mrcatz/datatable-vue/editor` — mendaftarkan renderer
 * `field.editor()` (Quill). Butuh paket `quill` (peer dependency opsional).
 *
 * @example
 * // app/plugins/mrcatz.ts
 * import '@mrcatz/datatable-vue/editor';
 */
import MrcEditor from './components/form/fields/MrcEditor.vue';
import { registerFieldType } from './components/form/registry';

registerFieldType('editor', MrcEditor);

export { MrcEditor };
