/**
 * Entry opsional `@mrc4tz/datatable-vue/editor-advanced` — mendaftarkan
 * renderer `field.editorAdvanced()` (TinyMCE 7). Butuh paket `tinymce`
 * (peer dependency opsional) atau `window.tinymce` dari CDN.
 *
 * @example
 * import '@mrc4tz/datatable-vue/editor-advanced';
 */
import MrcEditorAdvanced from './components/form/fields/MrcEditorAdvanced.vue';
import { registerFieldType } from './components/form/registry';

registerFieldType('editorAdvanced', MrcEditorAdvanced);

export { MrcEditorAdvanced };
