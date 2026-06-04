<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

type NavIcon = 'home' | 'journal' | 'metrics' | 'correlations' | 'more';

type NavItem = {
  to: string;
  labelKey: string;
  icon: NavIcon;
  exact?: boolean;
  matchMore?: boolean;
};

const { t } = useI18n();
const route = useRoute();

const items: NavItem[] = [
  { to: '/', labelKey: 'nav.home', icon: 'home', exact: true },
  { to: '/journal', labelKey: 'nav.journal', icon: 'journal' },
  { to: '/metrics', labelKey: 'nav.metrics', icon: 'metrics' },
  { to: '/correlations', labelKey: 'nav.correlations', icon: 'correlations' },
  { to: '/more', labelKey: 'nav.more', icon: 'more', matchMore: true },
];

const morePaths = ['/more', '/insights', '/profile-facts', '/account', '/design-system'];

function isActive(item: NavItem): boolean {
  if (item.matchMore) {
    return morePaths.some((path) => route.path === path || route.path.startsWith(`${path}/`));
  }
  if (item.exact) {
    return route.path === item.to;
  }
  return route.path === item.to || route.path.startsWith(`${item.to}/`);
}

const activeKey = computed(() => items.find((item) => isActive(item))?.to ?? null);
</script>

<template>
  <nav class="bottom-nav" :aria-label="t('nav.mobileNav')">
    <router-link
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="bottom-nav__item"
      :class="{ 'bottom-nav__item--active': activeKey === item.to }"
      :aria-current="activeKey === item.to ? 'page' : undefined"
    >
      <span class="bottom-nav__indicator" aria-hidden="true" />
      <span class="bottom-nav__icon" :data-icon="item.icon" aria-hidden="true" />
      <span class="bottom-nav__label">{{ t(item.labelKey) }}</span>
    </router-link>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 50;
  display: none;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0;
  padding: var(--space-1) var(--space-2) calc(var(--space-2) + env(safe-area-inset-bottom, 0px));
  background: color-mix(in srgb, var(--color-surface) 92%, transparent);
  backdrop-filter: blur(12px);
  border-top: 1px solid rgba(225, 226, 221, 0.85);
  box-shadow: 0 -10px 30px rgba(12, 13, 16, 0.06);
}

@media (max-width: 767px) {
  .bottom-nav {
    display: grid;
  }
}

.bottom-nav__item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  min-height: 3.25rem;
  padding: var(--space-1) var(--space-1) var(--space-2);
  border-radius: var(--radius-lg);
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: color 0.15s ease, background 0.15s ease;
}

.bottom-nav__item--active {
  color: var(--color-text-primary);
}

.bottom-nav__indicator {
  position: absolute;
  top: 0.2rem;
  width: 1.25rem;
  height: 2px;
  border-radius: var(--radius-pill);
  background: transparent;
  transition: background 0.15s ease;
}

.bottom-nav__item--active .bottom-nav__indicator {
  background: var(--color-primary);
}

.bottom-nav__icon {
  display: block;
  width: 1.25rem;
  height: 1.25rem;
  background: currentColor;
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
}

.bottom-nav__label {
  max-width: 100%;
  font-size: 0.625rem;
  font-weight: var(--font-weight-medium);
  line-height: 1.1;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bottom-nav__icon[data-icon='home'] {
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z'/%3E%3C/svg%3E");
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z'/%3E%3C/svg%3E");
}

.bottom-nav__icon[data-icon='journal'] {
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M6 4h9a3 3 0 0 1 3 3v14l-3-2-3 2-3-2-3 2V7a3 3 0 0 1 3-3Z'/%3E%3C/svg%3E");
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M6 4h9a3 3 0 0 1 3 3v14l-3-2-3 2-3-2-3 2V7a3 3 0 0 1 3-3Z'/%3E%3C/svg%3E");
}

.bottom-nav__icon[data-icon='metrics'] {
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M4 19V5m0 14h16M8 17V9m4 17V7m4 13v-5'/%3E%3C/svg%3E");
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M4 19V5m0 14h16M8 17V9m4 17V7m4 13v-5'/%3E%3C/svg%3E");
}

.bottom-nav__icon[data-icon='correlations'] {
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M7 17l4-4 3 3 5-7'/%3E%3Ccircle cx='7' cy='17' r='1.5'/%3E%3Ccircle cx='18' cy='9' r='1.5'/%3E%3C/svg%3E");
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Cpath d='M7 17l4-4 3 3 5-7'/%3E%3Ccircle cx='7' cy='17' r='1.5'/%3E%3Ccircle cx='18' cy='9' r='1.5'/%3E%3C/svg%3E");
}

.bottom-nav__icon[data-icon='more'] {
  mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Ccircle cx='6' cy='12' r='1.5'/%3E%3Ccircle cx='12' cy='12' r='1.5'/%3E%3Ccircle cx='18' cy='12' r='1.5'/%3E%3C/svg%3E");
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2'%3E%3Ccircle cx='6' cy='12' r='1.5'/%3E%3Ccircle cx='12' cy='12' r='1.5'/%3E%3Ccircle cx='18' cy='12' r='1.5'/%3E%3C/svg%3E");
}
</style>
