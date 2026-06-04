<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAppLocale } from '../composables/useAppLocale';
import { useAuthStore } from '../stores/auth';
import { useLocaleStore } from '../stores/locale';
import AppShell from '../components/ui/AppShell.vue';
import Button from '../components/ui/Button.vue';
import Card from '../components/ui/Card.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import PageStack from '../components/ui/PageStack.vue';

const { t } = useAppLocale();
const router = useRouter();
const auth = useAuthStore();
const localeStore = useLocaleStore();

const showDesignLink = import.meta.env.DEV;

const userInitial = computed(() => {
  const username = auth.user?.telegramUsername?.trim();
  if (username) {
    return username.charAt(0).toUpperCase();
  }
  return 'M';
});

const displayName = computed(() => {
  const username = auth.user?.telegramUsername?.trim();
  if (!username) {
    return t('more.guestName');
  }
  return username.startsWith('@') ? username : `@${username}`;
});

const menuItems = computed(() => {
  const items = [
    { to: '/insights', labelKey: 'nav.insights', hintKey: 'more.insightsHint' },
    { to: '/profile-facts', labelKey: 'nav.profileFacts', hintKey: 'more.profileFactsHint' },
    { to: '/account', labelKey: 'nav.account', hintKey: 'more.accountHint' },
  ];
  if (showDesignLink) {
    items.push({ to: '/design-system', labelKey: 'nav.designSystem', hintKey: 'more.designHint' });
  }
  return items;
});

async function setLocale(code: 'en' | 'uk') {
  await localeStore.setLocale(code);
}

async function signOut() {
  await auth.signOut(router);
}
</script>

<template>
  <AppShell>
    <PageStack>
      <PageHeader :title="t('more.title')" :tagline="t('more.tagline')" />

      <Card padding="lg" elevated class="more-profile">
        <div class="more-profile__avatar" aria-hidden="true">{{ userInitial }}</div>
        <div class="more-profile__text">
          <p class="more-profile__name">{{ displayName }}</p>
          <p class="more-profile__hint text-muted">{{ t('more.profileHint') }}</p>
        </div>
      </Card>

      <Card padding="lg" elevated>
        <ul class="list-rows">
          <li v-for="item in menuItems" :key="item.to" class="list-row">
            <div class="list-row__main">
              <router-link :to="item.to" class="list-row__title">{{ t(item.labelKey) }}</router-link>
              <span class="list-row__meta">{{ t(item.hintKey) }}</span>
            </div>
          </li>
        </ul>
      </Card>

      <Card padding="lg" elevated class="more-actions">
        <p class="more-actions__label">{{ t('nav.language') }}</p>
        <div class="more-locale" role="group" :aria-label="t('nav.language')">
          <button
            type="button"
            class="more-locale__btn"
            :class="{ 'more-locale__btn--active': localeStore.locale === 'en' }"
            @click="setLocale('en')"
          >
            EN
          </button>
          <button
            type="button"
            class="more-locale__btn"
            :class="{ 'more-locale__btn--active': localeStore.locale === 'uk' }"
            @click="setLocale('uk')"
          >
            UK
          </button>
        </div>

        <Button variant="ghost" class="more-signout" @click="signOut">{{ t('nav.signOut') }}</Button>
      </Card>
    </PageStack>
  </AppShell>
</template>

<style scoped>
.more-profile {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.more-profile__avatar {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  border-radius: var(--radius-pill);
  background: var(--color-peach);
  color: var(--color-text-primary);
  font-size: var(--text-body);
  font-weight: var(--font-weight-semibold);
  flex-shrink: 0;
}

.more-profile__name {
  margin: 0;
  font-weight: var(--font-weight-semibold);
}

.more-profile__hint {
  margin: var(--space-1) 0 0;
  font-size: var(--text-small);
}

.more-actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.more-actions__label {
  margin: 0;
  font-size: var(--text-small);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.more-locale {
  display: inline-flex;
  align-self: flex-start;
  padding: 2px;
  background: var(--color-surface-muted);
  border-radius: var(--radius-pill);
}

.more-locale__btn {
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  padding: 0.4rem 0.85rem;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.more-locale__btn--active {
  background: var(--color-yellow-soft);
  color: var(--color-text-primary);
}

.more-signout {
  align-self: flex-start;
}
</style>
