import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { Router } from 'vue-router';
import type { AuthUser } from '@metrixify/shared-types';
import { exchangeTelegramToken, fetchMe, logout as apiLogout } from '../api/auth';
import { useLocaleStore } from './locale';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null);
  const initialized = ref(false);
  const loading = ref(false);

  /** Sync auth state with the server (use on protected navigation). */
  async function refreshSession(): Promise<void> {
    loading.value = true;
    try {
      const result = await fetchMe();
      user.value = result?.user ?? null;
      if (user.value?.locale) {
        useLocaleStore().applyLocale(user.value.locale);
      }
    } finally {
      loading.value = false;
      initialized.value = true;
    }
  }

  async function loadSession(): Promise<void> {
    if (!initialized.value) {
      await refreshSession();
    }
  }

  async function loginWithTelegramToken(token: string): Promise<void> {
    const result = await exchangeTelegramToken(token);
    user.value = result.user;
    initialized.value = true;
  }

  async function logout(): Promise<void> {
    await apiLogout();
    user.value = null;
  }

  /** Clears session server-side and navigates to the login page. */
  async function signOut(router: Router): Promise<void> {
    user.value = null;
    try {
      await apiLogout();
    } finally {
      user.value = null;
      await router.replace({ name: 'login', query: { signedOut: '1' } });
    }
  }

  const isAuthenticated = computed(() => Boolean(user.value));

  return {
    user,
    initialized,
    loading,
    isAuthenticated,
    loadSession,
    refreshSession,
    loginWithTelegramToken,
    logout,
    signOut,
  };
});
