<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { deleteAllUserData, downloadUserExport } from '../api/user';
import { useAppLocale } from '../composables/useAppLocale';
import { useAuthStore } from '../stores/auth';
import { useLocaleStore } from '../stores/locale';
import AppShell from '../components/ui/AppShell.vue';
import Button from '../components/ui/Button.vue';
import Card from '../components/ui/Card.vue';
import ErrorState from '../components/ui/ErrorState.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import PageStack from '../components/ui/PageStack.vue';

const CONFIRM_PHRASE = 'DELETE';

const { t } = useAppLocale();
const router = useRouter();
const auth = useAuthStore();
const localeStore = useLocaleStore();

const confirmText = ref('');
const deleting = ref(false);
const exportingFormat = ref<'json' | 'xlsx' | null>(null);
const error = ref<string | null>(null);
const exportError = ref<string | null>(null);
const exportSuccess = ref(false);
const success = ref(false);

const canSubmit = computed(() => confirmText.value.trim() === CONFIRM_PHRASE);

async function setLocale(code: 'en' | 'uk') {
  await localeStore.setLocale(code);
}

async function signOut() {
  await auth.signOut(router);
}

async function handleExport(format: 'json' | 'xlsx') {
  exportingFormat.value = format;
  exportError.value = null;
  exportSuccess.value = false;
  try {
    await downloadUserExport(format);
    exportSuccess.value = true;
  } catch (e) {
    exportError.value = e instanceof Error ? e.message : t('account.exportError');
  } finally {
    exportingFormat.value = null;
  }
}

async function handleDelete() {
  if (!canSubmit.value || deleting.value) {
    return;
  }

  const confirmed = window.confirm(t('account.deleteFinalConfirm'));
  if (!confirmed) {
    return;
  }

  deleting.value = true;
  error.value = null;
  try {
    await deleteAllUserData();
    success.value = true;
    confirmText.value = '';
    await router.push({ name: 'home' });
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('account.deleteError');
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <AppShell>
    <PageStack>
      <PageHeader :title="t('account.title')" :tagline="t('account.tagline')">
        <template #actions>
          <div class="account-locale" role="group" :aria-label="t('nav.language')">
            <button
              type="button"
              class="account-locale__btn"
              :class="{ 'account-locale__btn--active': localeStore.locale === 'en' }"
              @click="setLocale('en')"
            >
              EN
            </button>
            <button
              type="button"
              class="account-locale__btn"
              :class="{ 'account-locale__btn--active': localeStore.locale === 'uk' }"
              @click="setLocale('uk')"
            >
              UK
            </button>
          </div>
          <Button variant="ghost" size="sm" @click="signOut">{{ t('nav.signOut') }}</Button>
        </template>
      </PageHeader>

      <Card class="account-settings" padding="lg" elevated>
        <h2 class="account-settings__heading typo-h3">{{ t('account.settingsTitle') }}</h2>
        <p class="text-muted">{{ t('account.settingsHint') }}</p>
      </Card>

      <Card class="account-export" padding="lg" elevated>
        <h2 class="account-export__heading typo-h3">{{ t('account.exportTitle') }}</h2>
        <p>{{ t('account.exportIntro') }}</p>
        <ul class="account-export__list">
          <li>{{ t('account.exportItemJournal') }}</li>
          <li>{{ t('account.exportItemMetrics') }}</li>
          <li>{{ t('account.exportItemFacts') }}</li>
          <li>{{ t('account.exportItemAnalytics') }}</li>
          <li>{{ t('account.exportItemInsights') }}</li>
        </ul>
        <p v-if="exportSuccess" class="account-export__success">{{ t('account.exportSuccess') }}</p>
        <ErrorState v-if="exportError" :message="exportError" />
        <div class="account-export__actions">
          <Button
            variant="secondary"
            :loading="exportingFormat === 'json'"
            @click="handleExport('json')"
          >
            {{ t('account.exportButtonJson') }}
          </Button>
          <Button
            variant="secondary"
            :loading="exportingFormat === 'xlsx'"
            @click="handleExport('xlsx')"
          >
            {{ t('account.exportButtonExcel') }}
          </Button>
        </div>
      </Card>

      <Card class="account-danger" padding="lg" elevated>
        <h2 class="account-danger__heading typo-h3">{{ t('account.dangerZone') }}</h2>
        <p>{{ t('account.deleteIntro') }}</p>
        <ul class="account-danger__list">
          <li>{{ t('account.deleteItemJournal') }}</li>
          <li>{{ t('account.deleteItemMetrics') }}</li>
          <li>{{ t('account.deleteItemFacts') }}</li>
          <li>{{ t('account.deleteItemAnalytics') }}</li>
        </ul>
        <p class="account-danger__hint">{{ t('account.deleteKeepLogin') }}</p>

        <label class="account-danger__label" for="delete-confirm">
          {{ t('account.deleteTypeConfirm', { phrase: CONFIRM_PHRASE }) }}
        </label>
        <input
          id="delete-confirm"
          v-model="confirmText"
          class="account-danger__input"
          type="text"
          autocomplete="off"
          spellcheck="false"
          :placeholder="CONFIRM_PHRASE"
        />

        <ErrorState v-if="error" :message="error" />
        <p v-else-if="success" class="account-danger__success">{{ t('account.deleteSuccess') }}</p>

        <Button
          variant="destructive"
          :disabled="!canSubmit"
          :loading="deleting"
          @click="handleDelete"
        >
          {{ t('account.deleteButton') }}
        </Button>
      </Card>
    </PageStack>
  </AppShell>
</template>

<style scoped>
.account-danger {
  max-width: 40rem;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.account-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.account-export {
  max-width: 40rem;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.account-export__heading {
  margin: 0;
}

.account-export__list {
  margin: 0;
  padding-left: 1.25rem;
  color: var(--color-text-secondary);
}

.account-export__success {
  margin: 0;
  color: var(--color-positive);
}

.account-export__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.account-settings__heading {
  margin: 0;
}

.account-locale {
  display: inline-flex;
  padding: 2px;
  background: var(--color-surface-muted);
  border-radius: var(--radius-pill);
}

.account-locale__btn {
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  padding: 0.35rem 0.65rem;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
}

.account-locale__btn--active {
  background: var(--color-yellow-soft);
  color: var(--color-text-primary);
}

.account-danger__heading {
  margin: 0;
}

.account-danger__list {
  margin: 0;
  padding-left: 1.25rem;
  color: var(--color-text-secondary);
}

.account-danger__hint {
  margin: 0;
  font-size: var(--text-small);
  color: var(--color-text-secondary);
}

.account-danger__label {
  font-size: var(--text-small);
  font-weight: var(--font-weight-medium);
}

.account-danger__input {
  width: 100%;
  max-width: 16rem;
  padding: 0.55rem 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  font: inherit;
  background: var(--color-surface-muted);
}

.account-danger__success {
  margin: 0;
  color: var(--color-positive);
}
</style>
