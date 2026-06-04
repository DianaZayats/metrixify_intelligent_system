<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { InsightReportDetail } from '@metrixify/shared-types';
import { fetchInsightsList, generateInsights } from '../api/insights';
import { useAppLocale } from '../composables/useAppLocale';
import AppShell from '../components/ui/AppShell.vue';
import Button from '../components/ui/Button.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import ErrorState from '../components/ui/ErrorState.vue';
import LoadingState from '../components/ui/LoadingState.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import PageStack from '../components/ui/PageStack.vue';
import InsightReportPanel from '../components/insights/InsightReportPanel.vue';

const { t, localeStore } = useAppLocale();

const reports = ref<InsightReportDetail[]>([]);
const total = ref(0);
const loading = ref(true);
const generating = ref(false);
const error = ref<string | null>(null);

async function loadReports() {
  loading.value = true;
  error.value = null;
  try {
    const data = await fetchInsightsList();
    reports.value = data.items ?? [];
    total.value = data.total;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load';
  } finally {
    loading.value = false;
  }
}

async function handleGenerate() {
  generating.value = true;
  error.value = null;
  try {
    const data = await generateInsights();
    reports.value = [data.report, ...reports.value.filter((item) => item.id !== data.report.id)];
    total.value += 1;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to generate';
  } finally {
    generating.value = false;
  }
}

onMounted(async () => {
  await loadReports();
});

watch(
  () => localeStore.locale,
  async () => {
    if (!loading.value) {
      await loadReports();
    }
  },
);
</script>

<template>
  <AppShell>
    <PageStack>
      <PageHeader :title="t('insights.title')" :tagline="t('insights.tagline')">
        <template #actions>
          <Button variant="dark" :loading="generating" :disabled="loading" @click="handleGenerate">
            {{ generating ? t('insights.generating') : t('insights.generate') }}
          </Button>
        </template>
      </PageHeader>

      <LoadingState v-if="loading" :message="t('insights.loading')" />
      <ErrorState v-else-if="error" :message="error" />
      <EmptyState
        v-else-if="reports.length === 0"
        :title="t('insights.emptyTitle')"
        :description="t('insights.emptyDescription')"
      >
        <template #action>
          <Button variant="dark" :loading="generating" @click="handleGenerate">
            {{ generating ? t('insights.generating') : t('insights.generateFirst') }}
          </Button>
        </template>
      </EmptyState>
      <template v-else>
        <p v-if="total > reports.length" class="insights-history-meta text-muted">
          {{ t('insights.showingReports', { shown: reports.length, total }) }}
        </p>
        <InsightReportPanel v-for="report in reports" :key="report.id" :report="report" />
      </template>
    </PageStack>
  </AppShell>
</template>

<style scoped>
.insights-history-meta {
  margin: 0;
  font-size: var(--text-small);
}
</style>
