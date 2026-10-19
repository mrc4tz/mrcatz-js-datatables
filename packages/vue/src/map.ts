/**
 * Entry opsional `@mrcatz/datatable-vue/map` — mendaftarkan renderer
 * `field.map()`. Provider `leaflet` butuh paket `leaflet` (peer dependency
 * opsional); provider `google` memuat SDK Google Maps dengan `apiKey`.
 *
 * @example
 * import '@mrcatz/datatable-vue/map';
 */
import MrcMapPicker from './components/form/fields/MrcMapPicker.vue';
import { registerFieldType } from './components/form/registry';

registerFieldType('map', MrcMapPicker);

export { MrcMapPicker };
