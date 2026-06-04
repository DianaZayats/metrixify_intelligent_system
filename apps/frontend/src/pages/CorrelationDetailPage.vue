<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { CorrelationDetail } from '@metrixify/shared-types';
import { fetchCorrelation } from '../api/analytics';
import { useAppLocale } from '../composables/useAppLocale';
import { getEChartsThemeColors, useEChartsChart } from '../composables/useEChartsTheme';
import AppShell from '../components/ui/AppShell.vue';
import Badge from '../components/ui/Badge.vue';
import Card from '../components/ui/Card.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import ErrorState from '../components/ui/ErrorState.vue';
import LoadingState from '../components/ui/LoadingState.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import PageStack from '../components/ui/PageStack.vue';
import SectionBlock from '../components/ui/SectionBlock.vue';

const route = useRoute();
const { t, formatDateTime, enumLabel } = useAppLocale();

const detail = ref<CorrelationDetail | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const scatterEl = ref<HTMLElement | null>(null);
const lineEl = ref<HTMLElement | null>(null);
const { setOption: setScatterOption, resize: resizeScatter } = useEChartsChart(scatterEl);
const { setOption: setLineOption, resize: resizeLine } = useEChartsChart(lineEl);

const correlationId = computed(() => String(route.params.id ?? ''));

function formatCorrelation(value: number): string {
  return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

async function loadDetail() {
  loading.value = true;
  error.value = null;
  try {
    detail.value = await fetchCorrelation(correlationId.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('common.error');
  } finally {
    loading.value = false;
  }
}

function renderScatter() {
  const item = detail.value;
  if (!item || item.scatter.length === 0) {
    return;
  }

  const colors = getEChartsThemeColors();
  setScatterOption({
    textStyle: { color: colors.textPrimary, fontFamily: colors.fontFamily },
    tooltip: {
      trigger: 'item',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      textStyle: { color: colors.textPrimary },
      formatter(params: { data?: [number, number, string] }) {
        const point = params.data;
        if (!point) {
          return '';
        }
        return `${point[2]}<br/>${item.metricATitle}: ${point[0]}<br/>${item.metricBTitle}: ${point[1]}`;
      },
    },
    grid: { left: 48, right: 24, top: 24, bottom: 48 },
    xAxis: {
      name: item.metricATitle,
      nameLocation: 'middle',
      nameGap: 32,
      axisLine: { lineStyle: { color: colors.border } },
      axisLabel: { color: colors.textSecondary },
      splitLine: { lineStyle: { color: colors.border, type: 'dashed' } },
    },
    yAxis: {
      name: item.metricBTitle,
      nameLocation: 'middle',
      nameGap: 40,
      axisLine: { lineStyle: { color: colors.border } },
      axisLabel: { color: colors.textSecondary },
      splitLine: { lineStyle: { color: colors.border, type: 'dashed' } },
    },
    series: [
      {
        type: 'scatter',
        symbolSize: 10,
        itemStyle: { color: colors.correlationStrong },
        data: item.scatter.map((point) => [point.x, point.y, point.date]),
      },
    ],
  });
}

function renderLineChart() {
  const item = detail.value;
  if (!item || item.seriesA.length === 0) {
    return;
  }

  const colors = getEChartsThemeColors();
  const dates = item.seriesA.map((point) => point.date);
  const denseDates = dates.length > 7;

  setLineOption({
    textStyle: { color: colors.textPrimary, fontFamily: colors.fontFamily },
    legend: {
      data: [item.metricATitle, item.metricBTitle],
      top: 0,
      left: 'center',
      itemGap: 20,
      textStyle: { color: colors.textSecondary, fontSize: 12 },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      textStyle: { color: colors.textPrimary },
    },
    grid: { left: 52, right: 24, top: 40, bottom: denseDates ? 72 : 52 },
    xAxis: {
      type: 'category',
      data: dates,
      axisLine: { lineStyle: { color: colors.border } },
      axisLabel: {
        color: colors.textSecondary,
        fontSize: 11,
        rotate: denseDates ? 40 : 0,
        margin: denseDates ? 16 : 12,
        interval: dates.length > 14 ? Math.ceil(dates.length / 12) - 1 : 0,
        hideOverlap: true,
      },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: colors.border } },
      axisLabel: { color: colors.textSecondary },
      splitLine: { lineStyle: { color: colors.border, type: 'dashed' } },
    },
    series: [
      {
        name: item.metricATitle,
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { color: colors.primary, width: 2 },
        data: item.seriesA.map((point) => point.value),
      },
      {
        name: item.metricBTitle,
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { color: colors.correlationStrong, width: 2 },
        data: item.seriesB.map((point) => point.value),
      },
    ],
  });
}

watch(
  () => detail.value,
  async () => {
    await nextTick();
    renderScatter();
    renderLineChart();
    resizeScatter();
    resizeLine();
  },
);

watch(correlationId, loadDetail);

onMounted(loadDetail);
</script>

<template>
  <AppShell>
    <PageStack>
      <PageHeader
        :title="t('correlations.detailTitle')"
        :tagline="detail ? `${detail.metricATitle} ↔ ${detail.metricBTitle}` : undefined"
      >
        <template #actions>
          <router-link to="/correlations" class="back-link">{{ t('nav.backToCorrelations') }}</router-link>
        </template>
      </PageHeader>

      <LoadingState v-if="loading" :message="t('correlations.loadingDetail')" />
      <ErrorState v-else-if="error" :message="error" />

      <template v-else-if="detail">
        <Card class="summary-card" padding="lg" elevated>
          <div class="summary-grid">
          <div>
            <p class="summary-label">{{ t('correlations.colR') }}</p>
            <p class="summary-value"><Badge>{{ formatCorrelation(detail.correlationValue) }}</Badge></p>
          </div>
          <div>
            <p class="summary-label">{{ t('correlations.alternateMethod') }}</p>
            <p class="summary-value">
              {{
                detail.alternateMethodValue !== null
                  ? formatCorrelation(detail.alternateMethodValue)
                  : t('common.dash')
              }}
            </p>
          </div>
          <div>
            <p class="summary-label">{{ t('correlations.colMethod') }}</p>
            <p class="summary-value">{{ enumLabel('correlationMethod', detail.method) }}</p>
          </div>
          <div>
            <p class="summary-label">{{ t('correlations.colLag') }}</p>
            <p class="summary-value">{{ detail.lagDays }}</p>
          </div>
          <div>
            <p class="summary-label">{{ t('correlations.colStrength') }}</p>
            <p class="summary-value">{{ enumLabel('strengthLabel', detail.strengthLabel) }}</p>
          </div>
          <div>
            <p class="summary-label">{{ t('correlations.colSample') }}</p>
            <p class="summary-value">
              {{ detail.sampleSize }}
              ({{ enumLabel('sampleTier', detail.sampleTier) }})
            </p>
          </div>
        </div>
        <p class="sample-note text-muted">{{ t('correlations.minSampleNote') }}</p>
        </Card>

        <Card padding="lg" elevated>
        <SectionBlock :title="t('correlations.scatterTitle')">
          <EmptyState v-if="detail.scatter.length === 0" :title="t('correlations.noChartData')" />
          <div v-else ref="scatterEl" class="chart" role="img" :aria-label="t('correlations.scatterTitle')" />
        </SectionBlock>
        </Card>

        <Card padding="lg" elevated>
          <SectionBlock :title="t('correlations.lineTitle')">
          <EmptyState v-if="detail.seriesA.length === 0" :title="t('correlations.noChartData')" />
          <div v-else ref="lineEl" class="chart chart--line" role="img" :aria-label="t('correlations.lineTitle')" />
        </SectionBlock>
        </Card>

        <Card padding="lg" elevated>
          <SectionBlock :title="t('correlations.relatedEntries')">
            <EmptyState v-if="detail.relatedEntries.length === 0" :title="t('correlations.noRelatedEntries')" />
            <ul v-else class="list-rows">
              <li v-for="entry in detail.relatedEntries" :key="entry.entryId" class="list-row">
                <div class="list-row__main">
                  <router-link :to="`/journal/${entry.entryId}`" class="list-row__title">
                    {{ entry.summaryText ?? t('journal.voiceMessage') }}
                  </router-link>
                  <span class="list-row__meta">{{ entry.entryDate }}</span>
                </div>
              </li>
            </ul>
          </SectionBlock>
        </Card>

        <p class="updated-at text-muted">
          {{ t('correlations.lastUpdated') }}: {{ formatDateTime(detail.calculatedAt) }}
        </p>
      </template>
    </PageStack>
  </AppShell>
</template>

<style scoped>
.back-link {
  color: var(--color-primary);
  text-decoration: none;
  font-size: var(--text-small);
  font-weight: var(--font-weight-medium);
}

.summary-card {
  /* spacing via PageStack */
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--space-4);
}

.summary-label {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--color-text-secondary);
}

.summary-value {
  margin: var(--space-1) 0 0;
  font-weight: var(--font-weight-medium);
}

.sample-note {
  margin: var(--space-4) 0 0;
  font-size: var(--text-small);
  color: var(--color-text-secondary);
}

.chart {
  width: 100%;
  height: 320px;
}

.chart--line {
  height: 360px;
}

.updated-at {
  margin: 0;
  font-size: var(--text-small);
}
</style>
