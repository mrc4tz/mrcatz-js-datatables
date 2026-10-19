import { VueQueryPlugin } from '@tanstack/vue-query';
import { createApp } from 'vue';
import { createMrcatz } from '@mrcatz/datatable-vue';
import App from './App.vue';
import './style.css';

createApp(App).use(VueQueryPlugin).use(createMrcatz({ locale: 'id' })).mount('#app');
