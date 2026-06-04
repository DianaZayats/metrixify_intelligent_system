<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { ProfileFactListItem } from '@metrixify/shared-types';
import { archiveProfileFact, fetchProfileFacts } from '../api/profile-facts';
import { useAppLocale } from '../composables/useAppLocale';
import ProfileFactCardList from '../components/profile-facts/ProfileFactCardList.vue';
import AppShell from '../components/ui/AppShell.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import ErrorState from '../components/ui/ErrorState.vue';
import LoadingState from '../components/ui/LoadingState.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import PageStack from '../components/ui/PageStack.vue';

const { t } = useAppLocale();

const items = ref<ProfileFactListItem[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const archivingId = ref<string | null>(null);

async function loadFacts() {
  loading.value = true;
  error.value = null;
  try {
    const data = await fetchProfileFacts();
    items.value = data.items ?? [];
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load';
  } finally {
    loading.value = false;
  }
}

async function handleArchive(fact: ProfileFactListItem) {
  if (fact.status === 'archived') {
    return;
  }
  archivingId.value = fact.id;
  try {
    await archiveProfileFact(fact.id);
    await loadFacts();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to archive';
  } finally {
    archivingId.value = null;
  }
}

onMounted(async () => {
  await loadFacts();
});
</script>

<template>
  <AppShell>
    <PageStack>
      <PageHeader :title="t('profileFacts.title')" :tagline="t('profileFacts.tagline')" />

      <LoadingState v-if="loading" :message="t('profileFacts.loading')" />
      <ErrorState v-else-if="error" :message="error" />
      <EmptyState v-else-if="items.length === 0" :title="t('profileFacts.empty')" />
      <div v-else class="facts-page">
        <p class="facts-page__hint text-muted">{{ t('profileFacts.listHint', { count: items.length }) }}</p>
        <p class="facts-page__legend text-caption text-muted">{{ t('profileFacts.reliabilityHint') }}</p>
        <ProfileFactCardList
          :items="items"
          :archiving-id="archivingId"
          @archive="handleArchive"
        />
      </div>
    </PageStack>
  </AppShell>
</template>

<style scoped>
.facts-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.facts-page__hint {
  margin: 0;
}

.facts-page__legend {
  margin: 0;
}
</style>
