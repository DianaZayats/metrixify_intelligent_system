import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import type { AppLocale } from '@metrixify/shared-types';
import { isAppLocale } from '@metrixify/shared-types';
import { i18n } from '../i18n';
import { updateUserLocale } from '../api/user';
import { useAuthStore } from './auth';

const STORAGE_KEY = 'metrixify_locale';

function readStoredLocale(): AppLocale {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored && isAppLocale(stored) ? stored : 'en';
}

export const useLocaleStore = defineStore('locale', () => {
  const locale = ref<AppLocale>(readStoredLocale());

  function applyLocale(next: AppLocale) {
    locale.value = next;
    i18n.global.locale.value = next;
    localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.lang = next === 'uk' ? 'uk' : 'en';
  }

  async function syncFromUser() {
    const auth = useAuthStore();
    if (auth.user?.locale && auth.user.locale !== locale.value) {
      applyLocale(auth.user.locale);
    }
  }

  async function setLocale(next: AppLocale) {
    applyLocale(next);
    const auth = useAuthStore();
    if (auth.isAuthenticated) {
      try {
        const result = await updateUserLocale(next);
        if (auth.user) {
          auth.user = { ...auth.user, locale: result.locale };
        }
      } catch {
        // Keep local preference even if API fails (offline)
      }
    }
  }

  watch(
    () => useAuthStore().user?.locale,
    (userLocale) => {
      if (userLocale && userLocale !== locale.value) {
        applyLocale(userLocale);
      }
    },
  );

  applyLocale(locale.value);

  return {
    locale,
    setLocale,
    syncFromUser,
    applyLocale,
  };
});
