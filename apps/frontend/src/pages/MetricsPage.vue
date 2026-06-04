<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { MetricDefinitionListItem, MetricObservationItem } from '@metrixify/shared-types';
import MetricObservationsTable from '../components/MetricObservationsTable.vue';
import MetricOverviewCard from '../components/metrics/MetricOverviewCard.vue';
import { fetchMetricObservations, fetchMetrics } from '../api/metrics';
import { useAppLocale } from '../composables/useAppLocale';
import AppShell from '../components/ui/AppShell.vue';
import CollapsibleSection from '../components/ui/CollapsibleSection.vue';
import DataTable from '../components/ui/DataTable.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import ErrorState from '../components/ui/ErrorState.vue';
import LoadingState from '../components/ui/LoadingState.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import PageStack from '../components/ui/PageStack.vue';
import SectionBlock from '../components/ui/SectionBlock.vue';
import TagChip from '../components/ui/TagChip.vue';

const { t, formatDateTime, enumLabel } = useAppLocale();

const items = ref<MetricDefinitionListItem[]>([]);
const observations = ref<MetricObservationItem[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const activeMetrics = computed(() =>
  [...items.value]
    .filter((metric) => metric.status === 'active')
    .sort((a, b) => a.title.localeCompare(b.title)),
);

const latestByMetricId = computed(() => {
  const map = new Map<string, MetricObservationItem>();
  for (const obs of observations.value) {
    if (!map.has(obs.metricDefinitionId)) {
      map.set(obs.metricDefinitionId, obs);
    }
  }
  return map;
});

function formatScale(metric: MetricDefinitionListItem): string {
  if (metric.valueType === 'ordinal' && metric.scaleMax !== null) {
    const min = metric.scaleMin ?? 1;
    return `${min}–${metric.scaleMax}`;
  }
  return t('common.dash');
}

onMounted(async () => {
  try {
    const [metricsData, observationsData] = await Promise.all([
      fetchMetrics(),
      fetchMetricObservations(),
    ]);
    items.value = metricsData.items ?? [];
    observations.value = observationsData.items ?? [];
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load';
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <AppShell>
    <PageStack>
      <PageHeader :title="t('metrics.title')" :tagline="t('metrics.tagline')" />

      <LoadingState v-if="loading" :message="t('metrics.loading')" />
      <ErrorState v-else-if="error" :message="error" />
      <EmptyState
        v-else-if="items.length === 0 && observations.length === 0"
        :title="t('metrics.empty')"
      />
      <div v-else class="metrics-page">
        <Card v-if="activeMetrics.length > 0" padding="lg" elevated>
          <section class="metrics-overview">
            <div class="metrics-overview__header">
              <h2 class="metrics-overview__title typo-h3">{{ t('metrics.overviewTitle') }}</h2>
              <p class="metrics-overview__hint text-muted">{{ t('metrics.overviewHint') }}</p>
            </div>
            <div class="metrics-overview__grid">
              <MetricOverviewCard
                v-for="metric in activeMetrics"
                :key="metric.id"
                :metric="metric"
                :observations="observations"
              />
            </div>
          </section>
        </Card>

        <CollapsibleSection
        :title="t('metrics.debugTablesTitle')"
        :subtitle="t('metrics.debugTablesHint', { definitions: items.length, observations: observations.length })"
      >
        <SectionBlock :title="t('metrics.definitions', { count: items.length })">
          <p v-if="items.length === 0" class="text-muted">{{ t('metrics.noDefinitions') }}</p>
          <DataTable v-else compact sticky-header>
            <thead>
              <tr>
                <th>{{ t('metrics.colTitle') }}</th>
                <th>{{ t('metrics.colKey') }}</th>
                <th>{{ t('metrics.colType') }}</th>
                <th>{{ t('metrics.colUnitScale') }}</th>
                <th>{{ t('metrics.colTags') }}</th>
                <th>{{ t('metrics.colLatest') }}</th>
                <th>{{ t('metrics.colCount') }}</th>
                <th>{{ t('metrics.colLastObserved') }}</th>
                <th>{{ t('metrics.colStatus') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="metric in items" :key="metric.id">
                <td :data-label="t('metrics.colTitle')">
                  <router-link :to="`/metrics/${metric.id}`">{{ metric.title }}</router-link>
                </td>
                <td :data-label="t('metrics.colKey')"><code>{{ metric.key }}</code></td>
                <td :data-label="t('metrics.colType')">{{ enumLabel('metricValueType', metric.valueType) }}</td>
                <td :data-label="t('metrics.colUnitScale')">
                  <span v-if="metric.unit">{{ metric.unit }}</span>
                  <span v-else>{{ formatScale(metric) }}</span>
                </td>
                <td :data-label="t('metrics.colTags')">
                  <span v-if="metric.tags.length === 0" class="text-muted">{{ t('common.dash') }}</span>
                  <span v-else class="tag-row">
                    <TagChip v-for="tag in metric.tags" :key="tag" :label="tag" />
                  </span>
                </td>
                <td class="cell-value" :data-label="t('metrics.colLatest')">
                  {{ latestByMetricId.get(metric.id)?.valueDisplay ?? t('common.dash') }}
                </td>
                <td :data-label="t('metrics.colCount')">{{ metric.observationCount }}</td>
                <td :data-label="t('metrics.colLastObserved')">{{ formatDateTime(metric.lastObservedAt) }}</td>
                <td :data-label="t('metrics.colStatus')">{{ enumLabel('metricStatus', metric.status) }}</td>
              </tr>
            </tbody>
          </DataTable>
        </SectionBlock>

        <SectionBlock :title="t('metrics.allObservations', { count: observations.length })">
          <p v-if="observations.length === 0" class="text-muted">{{ t('metrics.noObservations') }}</p>
          <MetricObservationsTable v-else :items="observations" />
        </SectionBlock>
      </CollapsibleSection>
      </div>
    </PageStack>
  </AppShell>
</template>

<style scoped>
.metrics-page {
  display: flex;
  flex-direction: column;
  gap: var(--dashboard-gap);
}

.metrics-overview__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}

.metrics-overview__title {
  margin: 0;
}

.metrics-overview__hint {
  margin: 0;
  font-size: var(--text-small);
}

.metrics-overview__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
  gap: var(--space-4);
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.cell-value {
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
}
</style>
