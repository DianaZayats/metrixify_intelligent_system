<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useAppLocale } from '../composables/useAppLocale';
import AppShell from '../components/ui/AppShell.vue';
import Card from '../components/ui/Card.vue';
import ErrorState from '../components/ui/ErrorState.vue';
import LoadingState from '../components/ui/LoadingState.vue';
import PageHeader from '../components/ui/PageHeader.vue';

const { t } = useAppLocale();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const status = ref<'loading' | 'error'>('loading');
const error = ref<string | null>(null);

onMounted(async () => {
  const token = route.query.token;
  if (typeof token !== 'string' || token.length < 16) {
    status.value = 'error';
    error.value = 'Missing or invalid login token. Request a new link with /login in Telegram.';
    return;
  }

  try {
    await auth.loginWithTelegramToken(token);
    await router.replace({ name: 'journal' });
  } catch (e) {
    status.value = 'error';
    error.value = e instanceof Error ? e.message : 'Login failed';
  }
});
</script>

<template>
  <AppShell :title="t('authToken.title')" :show-nav="false">
    <PageHeader :title="t('authToken.title')" />

    <LoadingState v-if="status === 'loading'" :message="t('authToken.loading')" />

    <Card v-else>
      <ErrorState :title="t('authToken.failed')" :message="error ?? t('common.error')">
        <template #action>
          <router-link to="/login">{{ t('nav.signIn') }}</router-link>
        </template>
      </ErrorState>
    </Card>
  </AppShell>
</template>
