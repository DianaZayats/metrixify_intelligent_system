import { createPinia } from 'pinia';
import { createApp } from 'vue';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import App from './App.vue';
import { i18n } from './i18n';
import { router } from './router';
import './styles/global.css';

const app = createApp(App);
app.use(createPinia());
app.use(i18n);
app.use(router);
app.mount('#app');
