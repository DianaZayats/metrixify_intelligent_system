<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useAppLocale } from '../composables/useAppLocale';
import AppShell from '../components/ui/AppShell.vue';
import Card from '../components/ui/Card.vue';
import PageHeader from '../components/ui/PageHeader.vue';

const { t } = useAppLocale();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const justSignedOut = computed(() => route.query.signedOut === '1');

onMounted(async () => {
  if (justSignedOut.value) {
    auth.$patch({ user: null });
    return;
  }

  await auth.refreshSession();
  if (auth.user) {
    await router.replace({ name: 'journal' });
  }
});
</script>

<template>
  <AppShell :title="t('login.title')" :show-nav="false">
    <div class="login-brand">
      <img src="/brand/logo-round.png" alt="" class="login-brand__icon" width="80" height="80" />
    </div>
    <PageHeader :title="t('login.title')" />

    <Card>
      <p>{{ t('login.intro') }}</p>
      <ol class="login-steps">
        <li>{{ t('login.step1') }}</li>
        <li>{{ t('login.step2') }}</li>
        <li>{{ t('login.step3') }}</li>
      </ol>
      <p v-if="justSignedOut" class="text-muted">{{ t('login.signedOut') }}</p>
    </Card>
  </AppShell>
</template>

<style scoped>
.login-brand {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-4);
}

.login-brand__icon {
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card-strong);
}

.login-steps {
  margin: var(--space-4) 0;
  padding-left: var(--space-5);
  line-height: var(--line-height-relaxed);
}
</style>
