<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { TagVariant } from '@metrixify/design-tokens';
import type { DiaryEntryListItem, ProcessingStatus } from '@metrixify/shared-types';
import { fetchEntries } from '../api/entries';
import { useAppLocale } from '../composables/useAppLocale';
import AppShell from '../components/ui/AppShell.vue';
import Badge from '../components/ui/Badge.vue';
import Card from '../components/ui/Card.vue';
import DashboardPanel from '../components/dashboard/DashboardPanel.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import ErrorState from '../components/ui/ErrorState.vue';
import LoadingState from '../components/ui/LoadingState.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import PageStack from '../components/ui/PageStack.vue';
import Pagination from '../components/ui/Pagination.vue';

const PAGE_SIZE = 15;

const { t, enumLabel } = useAppLocale();

const items = ref<DiaryEntryListItem[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(true);
const pageLoading = ref(false);
const error = ref<string | null>(null);

const panelTitle = computed(() => t('journal.entriesCount', { count: total.value }));

function preview(text: string | null, max = 120): string {
  if (!text) {
    return t('common.dash');
  }
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

function entryPreview(entry: DiaryEntryListItem): string {
  if (entry.summaryText) {
    return preview(entry.summaryText);
  }
  if (entry.rawText) {
    return preview(entry.rawText);
  }
  if (entry.processingStatus === 'summarizing') {
    return t('journal.generatingSummary');
  }
  if (entry.sourceType === 'voice') {
    if (entry.processingStatus === 'transcribing') {
      return t('journal.transcribing');
    }
    if (entry.processingStatus === 'failed') {
      return t('journal.voiceFailed');
    }
    return t('journal.voiceMessage');
  }
  return t('common.dash');
}

function statusBadgeVariant(status: ProcessingStatus): TagVariant {
  if (status === 'completed') {
    return 'positive';
  }
  if (status === 'failed') {
    return 'negative';
  }
  if (status === 'received' || status === 'transcribed') {
    return 'neutral';
  }
  return 'ai';
}

async function loadPage() {
  const isInitialLoad = items.value.length === 0 && error.value === null;
  if (isInitialLoad) {
    loading.value = true;
  } else {
    pageLoading.value = true;
  }

  try {
    const offset = (page.value - 1) * PAGE_SIZE;
    const data = await fetchEntries(PAGE_SIZE, offset);
    items.value = data.items;
    total.value = data.total;

    const maxPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
    if (page.value > maxPage) {
      page.value = maxPage;
      return;
    }

    error.value = null;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load';
  } finally {
    loading.value = false;
    pageLoading.value = false;
  }
}

watch(page, () => {
  void loadPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

onMounted(() => {
  void loadPage();
});
</script>

<template>
  <AppShell>
    <PageStack>
      <PageHeader :title="t('journal.title')" :tagline="t('journal.tagline')" />

      <LoadingState v-if="loading" :message="t('journal.loading')" />
      <ErrorState v-else-if="error" :message="error" />
      <EmptyState v-else-if="total === 0" :title="t('journal.empty')" />
      <Card v-else padding="lg" elevated :class="{ 'journal-card--loading': pageLoading }">
        <DashboardPanel :title="panelTitle">
          <ul class="list-rows">
            <li v-for="entry in items" :key="entry.id" class="list-row">
              <div class="list-row__main">
                <router-link :to="`/journal/${entry.id}`" class="list-row__title">
                  {{ entryPreview(entry) }}
                </router-link>
                <span class="list-row__meta">
                  <time :datetime="entry.entryDate">{{ entry.entryDate }}</time>
                  <Badge variant="neutral">{{ enumLabel('sourceType', entry.sourceType) }}</Badge>
                  <Badge :variant="statusBadgeVariant(entry.processingStatus)">
                    {{ enumLabel('processingStatus', entry.processingStatus) }}
                  </Badge>
                </span>
              </div>
            </li>
          </ul>

          <Pagination v-model:page="page" :page-size="PAGE_SIZE" :total="total" />
        </DashboardPanel>
      </Card>
    </PageStack>
  </AppShell>
</template>

<style scoped>
.journal-card--loading {
  opacity: 0.72;
  pointer-events: none;
}

.list-row__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}
</style>
