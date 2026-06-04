<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { useLocaleStore } from '../../stores/locale';

defineProps<{
  showDesignLink?: boolean;
}>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const localeStore = useLocaleStore();

type NavIcon =
  | 'home'
  | 'journal'
  | 'metrics'
  | 'correlations'
  | 'insights'
  | 'profileFacts'
  | 'account'
  | 'design'
  | 'signOut';

type NavItem = {
  to: string;
  labelKey: string;
  icon: NavIcon;
  exact?: boolean;
};

const primaryNav: NavItem[] = [
  { to: '/', labelKey: 'nav.home', icon: 'home', exact: true },
  { to: '/journal', labelKey: 'nav.journal', icon: 'journal' },
  { to: '/metrics', labelKey: 'nav.metrics', icon: 'metrics' },
  { to: '/correlations', labelKey: 'nav.correlations', icon: 'correlations' },
  { to: '/insights', labelKey: 'nav.insights', icon: 'insights' },
];

const secondaryNav: NavItem[] = [
  { to: '/profile-facts', labelKey: 'nav.profileFacts', icon: 'profileFacts' },
];

const accountNav: NavItem = {
  to: '/account',
  labelKey: 'nav.account',
  icon: 'account',
};

const userInitial = computed(() => {
  const username = auth.user?.telegramUsername?.trim();
  if (username) {
    return username.charAt(0).toUpperCase();
  }
  return 'M';
});

function isActive(item: NavItem): boolean {
  if (item.exact) {
    return route.path === item.to;
  }
  return route.path === item.to || route.path.startsWith(`${item.to}/`);
}

async function signOut() {
  await auth.signOut(router);
}

async function setLocale(code: 'en' | 'uk') {
  await localeStore.setLocale(code);
}
</script>

<template>
  <aside class="sidebar" :aria-label="t('nav.sidebar')">
    <router-link to="/" class="sidebar__brand" :aria-label="t('app.name')">
      <img
        src="/brand/logo-round.png"
        alt=""
        class="sidebar__logo-mark"
        width="48"
        height="48"
      />
      <span class="sidebar__logo-text">Metrixify</span>
    </router-link>

    <nav class="sidebar__primary" :aria-label="t('nav.sidebarPrimary')">
      <ul class="sidebar__pill">
        <li v-for="item in primaryNav" :key="item.to">
          <router-link
            :to="item.to"
            class="sidebar__link"
            :class="{ 'sidebar__link--active': isActive(item) }"
            :title="t(item.labelKey)"
          >
            <span class="sidebar__icon" :data-icon="item.icon" aria-hidden="true" />
            <span class="sidebar__label">{{ t(item.labelKey) }}</span>
          </router-link>
        </li>
      </ul>
    </nav>

    <nav class="sidebar__secondary" :aria-label="t('nav.sidebarSecondary')">
      <ul class="sidebar__stack">
        <li v-for="item in secondaryNav" :key="item.to">
          <router-link
            :to="item.to"
            class="sidebar__link sidebar__link--solo"
            :class="{ 'sidebar__link--active': isActive(item) }"
            :title="t(item.labelKey)"
          >
            <span class="sidebar__icon" :data-icon="item.icon" aria-hidden="true" />
            <span class="sidebar__label">{{ t(item.labelKey) }}</span>
          </router-link>
        </li>
        <li v-if="showDesignLink">
          <router-link
            to="/design-system"
            class="sidebar__link sidebar__link--solo"
            :class="{ 'sidebar__link--active': route.path === '/design-system' }"
            :title="t('nav.designSystem')"
          >
            <span class="sidebar__icon" data-icon="design" aria-hidden="true" />
            <span class="sidebar__label">{{ t('nav.designSystem') }}</span>
          </router-link>
        </li>
      </ul>
    </nav>

    <div class="sidebar__footer">
      <router-link
        to="/account"
        class="sidebar__link sidebar__link--solo"
        :class="{ 'sidebar__link--active': isActive(accountNav) }"
        :title="t('nav.account')"
      >
        <span class="sidebar__icon" data-icon="account" aria-hidden="true" />
        <span class="sidebar__label">{{ t('nav.account') }}</span>
      </router-link>

      <button
        type="button"
        class="sidebar__link sidebar__link--solo sidebar__link--button"
        :title="t('nav.signOut')"
        @click="signOut"
      >
        <span class="sidebar__icon" data-icon="signOut" aria-hidden="true" />
        <span class="sidebar__label">{{ t('nav.signOut') }}</span>
      </button>

      <div class="sidebar__locale" role="group" :aria-label="t('nav.language')">
        <button
          type="button"
          class="sidebar__locale-btn"
          :class="{ 'sidebar__locale-btn--active': localeStore.locale === 'en' }"
          @click="setLocale('en')"
        >
          EN
        </button>
        <button
          type="button"
          class="sidebar__locale-btn"
          :class="{ 'sidebar__locale-btn--active': localeStore.locale === 'uk' }"
          @click="setLocale('uk')"
        >
          UK
        </button>
      </div>

      <div class="sidebar__avatar" :title="auth.user?.telegramUsername ?? t('nav.account')">
        {{ userInitial }}
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  --sidebar-width: 5.75rem;
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 40;
  width: var(--sidebar-width);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-3) var(--space-4);
  background: var(--color-surface-warm);
  border-right: 1px solid var(--color-border);
}

@media (max-width: 767px) {
  .sidebar {
    display: none;
  }
}

.sidebar__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  text-decoration: none;
  color: inherit;
  flex-shrink: 0;
}

.sidebar__logo-mark {
  display: block;
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-pill);
  object-fit: cover;
  box-shadow: var(--shadow-card-strong);
}

.sidebar__logo-text {
  display: none;
  font-size: var(--text-caption);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

.sidebar__primary,
.sidebar__secondary {
  width: 100%;
}

.sidebar__pill,
.sidebar__stack {
  list-style: none;
  margin: 0;
  padding: 0;
}

.sidebar__pill {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-2xl);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--color-text-primary) 4%, transparent);
}

.sidebar__stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: center;
}

.sidebar__link {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  min-height: 3rem;
  padding: var(--space-2);
  border-radius: var(--radius-pill);
  color: var(--color-text-secondary);
  text-decoration: none;
  transition:
    background 0.15s ease,
    color 0.15s ease,
    transform 0.15s ease;
}

.sidebar__link--solo {
  min-height: 2.75rem;
  width: 2.75rem;
  padding: 0;
}

.sidebar__link--button {
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
}

.sidebar__link:hover {
  color: var(--color-text-primary);
  background: color-mix(in srgb, var(--color-primary-soft) 45%, transparent);
}

.sidebar__link--active {
  color: var(--color-text-primary);
  background: var(--color-primary-soft);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent-purple) 35%, transparent);
}

.sidebar__label {
  display: none;
}

@media (min-width: 1280px) {
  .sidebar {
    --sidebar-width: 7.5rem;
    padding-inline: var(--space-4);
  }

  .sidebar__logo-text {
    display: block;
  }

  .sidebar__label {
    display: block;
    max-width: 100%;
    font-size: 0.625rem;
    line-height: 1.15;
    text-align: center;
    word-break: break-word;
  }

  .sidebar__link {
    min-height: 3.35rem;
  }
}

.sidebar__icon {
  display: block;
  width: 1.35rem;
  height: 1.35rem;
  background: currentColor;
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
}

.sidebar__icon[data-icon='home'] {
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z'/%3E%3C/svg%3E");
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z'/%3E%3C/svg%3E");
}

.sidebar__icon[data-icon='journal'] {
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M6 4h9a3 3 0 0 1 3 3v14l-3-2-3 2-3-2-3 2V7a3 3 0 0 1 3-3Z'/%3E%3C/svg%3E");
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M6 4h9a3 3 0 0 1 3 3v14l-3-2-3 2-3-2-3 2V7a3 3 0 0 1 3-3Z'/%3E%3C/svg%3E");
}

.sidebar__icon[data-icon='metrics'] {
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M4 19V5m0 14h16M8 17V9m4 17V7m4 13v-5'/%3E%3C/svg%3E");
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M4 19V5m0 14h16M8 17V9m4 17V7m4 13v-5'/%3E%3C/svg%3E");
}

.sidebar__icon[data-icon='correlations'] {
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M7 17l4-4 3 3 5-7'/%3E%3Ccircle cx='7' cy='17' r='1.5'/%3E%3Ccircle cx='18' cy='9' r='1.5'/%3E%3C/svg%3E");
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M7 17l4-4 3 3 5-7'/%3E%3Ccircle cx='7' cy='17' r='1.5'/%3E%3Ccircle cx='18' cy='9' r='1.5'/%3E%3C/svg%3E");
}

.sidebar__icon[data-icon='insights'] {
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z'/%3E%3C/svg%3E");
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z'/%3E%3C/svg%3E");
}

.sidebar__icon[data-icon='profileFacts'] {
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M16 3H8a2 2 0 0 0-2 2v14l4-2 4 2 4-2V5a2 2 0 0 0-2-2Z'/%3E%3C/svg%3E");
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M16 3H8a2 2 0 0 0-2 2v14l4-2 4 2 4-2V5a2 2 0 0 0-2-2Z'/%3E%3C/svg%3E");
}

.sidebar__icon[data-icon='account'] {
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3Cpath d='M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42'/%3E%3C/svg%3E");
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3Cpath d='M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42'/%3E%3C/svg%3E");
}

.sidebar__icon[data-icon='design'] {
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z'/%3E%3C/svg%3E");
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z'/%3E%3C/svg%3E");
}

.sidebar__icon[data-icon='signOut'] {
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'/%3E%3C/svg%3E");
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'/%3E%3C/svg%3E");
}

.sidebar__footer {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
}

.sidebar__locale {
  display: inline-flex;
  padding: 2px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
}

.sidebar__locale-btn {
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  padding: 0.2rem 0.45rem;
  border-radius: var(--radius-pill);
  font-size: 0.625rem;
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.sidebar__locale-btn--active {
  background: var(--color-yellow-soft);
  color: var(--color-text-primary);
}

.sidebar__avatar {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-pill);
  background: var(--color-peach);
  color: var(--color-text-primary);
  font-size: var(--text-small);
  font-weight: var(--font-weight-semibold);
  border: 2px solid var(--color-surface);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--color-text-primary) 8%, transparent);
}
</style>
