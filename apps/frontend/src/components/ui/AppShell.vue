<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { useLocaleStore } from '../../stores/locale';
import AppSidebar from './AppSidebar.vue';
import AppBottomNav from './AppBottomNav.vue';
import Button from './Button.vue';

const props = withDefaults(
  defineProps<{
    title?: string;
    tagline?: string;
    showNav?: boolean;
    showDesignLink?: boolean;
  }>(),
  {
    title: 'Metrixify',
    tagline: undefined,
    showNav: true,
    showDesignLink: false,
  },
);

const { t } = useI18n();
const router = useRouter();
const auth = useAuthStore();
const localeStore = useLocaleStore();

const resolvedTagline = computed(
  () => props.tagline ?? t('app.tagline'),
);

const useSidebar = computed(
  () => props.showNav && auth.isAuthenticated,
);

async function signOut() {
  await auth.signOut(router);
}

async function setLocale(code: 'en' | 'uk') {
  await localeStore.setLocale(code);
}
</script>

<template>
  <div
    class="app-shell"
    :class="{ 'app-shell--with-sidebar': useSidebar }"
  >
    <AppSidebar v-if="useSidebar" :show-design-link="showDesignLink" />
    <AppBottomNav v-if="useSidebar" />

    <div class="app-shell__body">
      <header v-if="!useSidebar" class="app-shell__header">
        <div class="app-shell__brand">
          <router-link to="/" class="app-shell__logo">{{ title }}</router-link>
          <p v-if="resolvedTagline" class="app-shell__tagline text-small">{{ resolvedTagline }}</p>
        </div>

        <div class="app-shell__controls">
          <div class="locale-switch" role="group" :aria-label="t('nav.language')">
            <button
              type="button"
              class="locale-switch__btn"
              :class="{ 'locale-switch__btn--active': localeStore.locale === 'en' }"
              @click="setLocale('en')"
            >
              EN
            </button>
            <button
              type="button"
              class="locale-switch__btn"
              :class="{ 'locale-switch__btn--active': localeStore.locale === 'uk' }"
              @click="setLocale('uk')"
            >
              UK
            </button>
          </div>

          <nav v-if="showNav" class="app-shell__nav">
            <router-link v-if="showDesignLink" to="/design-system">{{ t('nav.designSystem') }}</router-link>
            <template v-if="auth.isAuthenticated">
              <router-link to="/journal">{{ t('nav.journal') }}</router-link>
              <router-link to="/metrics">{{ t('nav.metrics') }}</router-link>
              <router-link to="/correlations">{{ t('nav.correlations') }}</router-link>
              <router-link to="/insights">{{ t('nav.insights') }}</router-link>
              <router-link to="/profile-facts">{{ t('nav.profileFacts') }}</router-link>
              <router-link to="/account">{{ t('nav.account') }}</router-link>
              <Button variant="ghost" size="sm" @click="signOut">{{ t('nav.signOut') }}</Button>
            </template>
            <router-link v-else to="/login">{{ t('nav.signIn') }}</router-link>
          </nav>
        </div>
      </header>

      <main class="app-shell__main">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  width: 100%;
  max-width: 100vw;
  min-width: 0;
  min-height: 100vh;
  overflow-x: clip;
}

.app-shell--with-sidebar {
  display: flex;
}

.app-shell__body {
  flex: 1;
  min-width: 0;
  width: 100%;
  max-width: var(--layout-max-width);
  margin: 0 auto;
  padding: var(--space-4);
}

.app-shell--with-sidebar .app-shell__body {
  max-width: none;
  margin: 0;
  padding: var(--space-4);
  overflow-x: clip;
}

@media (min-width: 768px) {
  .app-shell--with-sidebar .app-shell__body {
    margin-left: 5.75rem;
    padding: var(--space-6) var(--space-8) var(--space-10);
  }
}

@media (max-width: 767px) {
  .app-shell--with-sidebar .app-shell__body {
    padding: var(--space-3) var(--space-4);
    padding-bottom: calc(4.25rem + env(safe-area-inset-bottom, 0px));
  }
}

@media (min-width: 1280px) {
  .app-shell--with-sidebar .app-shell__body {
    margin-left: 7.5rem;
  }
}

.app-shell__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-6);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

@media (min-width: 768px) {
  .app-shell__header {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }
}

.app-shell__logo {
  font-size: var(--text-h2);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-h2);
  color: var(--color-text-primary);
  text-decoration: none;
}

.app-shell__tagline {
  margin: var(--space-1) 0 0;
}

.app-shell__controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
}

@media (min-width: 768px) {
  .app-shell__controls {
    align-items: flex-end;
    width: auto;
  }
}

.locale-switch {
  display: inline-flex;
  padding: 2px;
  background: var(--color-surface-muted);
  border-radius: var(--radius-pill);
  align-self: flex-start;
}

.locale-switch__btn {
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  padding: 0.35rem 0.75rem;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.locale-switch__btn--active {
  background: var(--color-surface);
  color: var(--color-text-primary);
  box-shadow: 0 1px 2px rgba(12, 13, 16, 0.06);
}

.app-shell__nav {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-4);
}

.app-shell__nav a {
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: var(--text-small);
  font-weight: var(--font-weight-medium);
}

.app-shell__nav a.router-link-active {
  color: var(--color-primary);
}

.app-shell__main {
  min-height: 40vh;
  min-width: 0;
  max-width: 100%;
}
</style>
