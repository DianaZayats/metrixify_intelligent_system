import { createI18n } from 'vue-i18n';
import { messages } from './messages';

function readInitialLocale(): 'en' | 'uk' {
  const stored = localStorage.getItem('metrixify_locale');
  return stored === 'uk' ? 'uk' : 'en';
}

export const i18n = createI18n({
  legacy: false,
  locale: readInitialLocale(),
  fallbackLocale: 'en',
  messages,
});

export type MessageKey = keyof typeof messages.en;
