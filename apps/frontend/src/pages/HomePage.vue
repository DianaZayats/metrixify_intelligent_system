<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { DashboardResponse } from '@metrixify/shared-types';
import { fetchDashboard, recalculateAnalytics } from '../api/analytics';
import { generateInsights } from '../api/insights';
import { useAppLocale } from '../composables/useAppLocale';
import { getEChartsThemeColors, useEChartsChart } from '../composables/useEChartsTheme';
import DashboardHero from '../components/dashboard/DashboardHero.vue';
import DashboardPanel from '../components/dashboard/DashboardPanel.vue';
import DashboardStatCard from '../components/dashboard/DashboardStatCard.vue';
import AppShell from '../components/ui/AppShell.vue';
import Badge from '../components/ui/Badge.vue';
import Button from '../components/ui/Button.vue';
import Card from '../components/ui/Card.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import ErrorState from '../components/ui/ErrorState.vue';
import LoadingState from '../components/ui/LoadingState.vue';
import InsightReportPanel from '../components/insights/InsightReportPanel.vue';
import { useAuthStore } from '../stores/auth';

const { t, formatDateTime, enumLabel, localeStore } = useAppLocale();
const auth = useAuthStore();

const dashboard = ref<DashboardResponse | null>(null);
const loading = ref(true);
const recalculating = ref(false);
const generatingInsights = ref(false);
const error = ref<string | null>(null);
const analyzeNotice = ref<string | null>(null);
const insightsNotice = ref<string | null>(null);
const chartEl = ref<HTMLElement | null>(null);
const { setOption, resize } = useEChartsChart(chartEl);

const selectedMetricId = ref<string | null>(null);

const chartMetricOptions = computed(() => dashboard.value?.topMetrics ?? []);

const displayName = computed(() => {
  const username = auth.user?.telegramUsername?.trim();
  if (!username) {
    return t('dashboard.guestName');
  }
  const normalized = username.startsWith('@') ? username.slice(1) : username;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
});

const greeting = computed(() => t('dashboard.greeting', { name: displayName.value }));

async function loadDashboard(chartMetricId?: string | null) {
  loading.value = true;
  error.value = null;
  try {
    dashboard.value = await fetchDashboard({
      chartMetricId: chartMetricId ?? undefined,
    });
    selectedMetricId.value = dashboard.value.chartMetricId;
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('common.error');
  } finally {
    loading.value = false;
  }
}

async function runAnalysis() {
  recalculating.value = true;
  error.value = null;
  analyzeNotice.value = null;
  try {
    const result = await recalculateAnalytics();
    if (result.correlationCount === 0) {
      analyzeNotice.value = t('dashboard.analyzeResultEmpty');
    } else {
      analyzeNotice.value = t('dashboard.analyzeResult', {
        count: result.correlationCount,
        official: result.officialCount,
        exploratory: result.exploratoryCount,
      });
    }
    await loadDashboard(selectedMetricId.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('common.error');
  } finally {
    recalculating.value = false;
  }
}

async function runInsightsGeneration() {
  generatingInsights.value = true;
  error.value = null;
  insightsNotice.value = null;
  try {
    await generateInsights();
    insightsNotice.value = t('dashboard.insightsGenerated');
    await loadDashboard(selectedMetricId.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('common.error');
  } finally {
    generatingInsights.value = false;
  }
}

function formatCorrelation(value: number): string {
  return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

function renderChart() {
  const data = dashboard.value;
  if (!data || data.chartSeries.length === 0) {
    return;
  }

  const colors = getEChartsThemeColors();
  const metricTitle =
    chartMetricOptions.value.find((m) => m.id === data.chartMetricId)?.title ?? t('dashboard.chartTitle');

  setOption({
    textStyle: { color: colors.textPrimary, fontFamily: colors.fontFamily },
    tooltip: {
      trigger: 'axis',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      textStyle: { color: colors.textPrimary },
    },
    grid: { left: 48, right: 24, top: 24, bottom: 40 },
    xAxis: {
      type: 'category',
      data: data.chartSeries.map((point) => point.date),
      axisLine: { lineStyle: { color: colors.border } },
      axisLabel: { color: colors.textSecondary },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: colors.border } },
      axisLabel: { color: colors.textSecondary },
      splitLine: { lineStyle: { color: colors.border, type: 'dashed' } },
    },
    series: [
      {
        name: metricTitle,
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { color: colors.primary, width: 3 },
        itemStyle: { color: colors.primary },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${colors.primary}44` },
              { offset: 1, color: `${colors.primary}05` },
            ],
          },
        },
        data: data.chartSeries.map((point) => point.value),
      },
    ],
  });
}

watch(
  () => dashboard.value?.chartSeries,
  async () => {
    await nextTick();
    renderChart();
    resize();
  },
);

watch(selectedMetricId, async (metricId) => {
  if (!metricId || metricId === dashboard.value?.chartMetricId) {
    return;
  }
  await loadDashboard(metricId);
});

watch(
  () => localeStore.locale,
  async () => {
    if (dashboard.value) {
      await loadDashboard(selectedMetricId.value);
    }
  },
);

onMounted(async () => {
  await loadDashboard();
  await nextTick();
  renderChart();
});
</script>

<template>
  <AppShell>
    <LoadingState v-if="loading && !dashboard" :message="t('dashboard.loading')" />
    <ErrorState v-else-if="error && !dashboard" :message="error" />

    <div v-else-if="dashboard" class="page-stack">
      <DashboardHero :greeting="greeting" :subtitle="t('dashboard.greetingSubtitle')">
        <template #actions>
          <Button
            variant="secondary"
            :loading="generatingInsights"
            :disabled="loading"
            @click="runInsightsGeneration"
          >
            {{ generatingInsights ? t('dashboard.generatingInsights') : t('dashboard.generateInsights') }}
          </Button>
          <Button
            variant="dark"
            :loading="recalculating"
            :disabled="loading"
            @click="runAnalysis"
          >
            {{ recalculating ? t('dashboard.analyzing') : t('dashboard.analyze') }}
          </Button>
        </template>
      </DashboardHero>

      <ErrorState v-if="error" :message="error" />
      <p v-if="analyzeNotice" class="notice-pill notice-pill--success">{{ analyzeNotice }}</p>
      <p v-if="insightsNotice" class="notice-pill notice-pill--info">{{ insightsNotice }}</p>

      <div class="bento-row bento-row--stats">
        <DashboardStatCard
          :label="t('dashboard.entriesLast7Days')"
          :value="dashboard.entriesLast7Days"
          highlight
        />
        <DashboardStatCard
          :label="t('dashboard.lastAnalysis')"
          :value="dashboard.lastCalculatedAt ? formatDateTime(dashboard.lastCalculatedAt) : t('dashboard.neverAnalyzed')"
        />
        <DashboardStatCard
          :label="t('dashboard.lastInsights')"
          :value="
            dashboard.insightsFeed.latestGeneratedAt
              ? formatDateTime(dashboard.insightsFeed.latestGeneratedAt)
              : t('dashboard.neverGeneratedInsights')
          "
        />
      </div>

      <div class="bento-row bento-row--main">
        <Card variant="warm" padding="lg" elevated>
          <DashboardPanel :title="t('dashboard.chartTitle')">
            <div v-if="chartMetricOptions.length > 1" class="chart-controls">
              <label class="chart-label" for="chart-metric">{{ t('dashboard.chartMetric') }}</label>
              <select id="chart-metric" v-model="selectedMetricId" class="chart-select">
                <option v-for="metric in chartMetricOptions" :key="metric.id" :value="metric.id">
                  {{ metric.title }}
                </option>
              </select>
            </div>
            <EmptyState v-if="dashboard.chartSeries.length === 0" :title="t('dashboard.noChartData')" />
            <div v-else ref="chartEl" class="chart" role="img" :aria-label="t('dashboard.chartTitle')" />
          </DashboardPanel>
        </Card>

        <Card variant="dark" padding="lg" elevated>
          <DashboardPanel
            :title="t('dashboard.topCorrelations')"
            link-to="/correlations"
            :link-text="t('dashboard.viewAllCorrelations')"
          >
            <EmptyState
              v-if="!dashboard.hasCorrelationResults"
              :title="t('dashboard.noCorrelations')"
              :description="t('dashboard.runAnalysisHint')"
            />
            <ul v-else class="list-rows">
              <li v-for="item in dashboard.topCorrelations" :key="item.id" class="list-row">
                <div class="list-row__main">
                  <router-link :to="`/correlations/${item.id}`" class="list-row__title">
                    {{ item.metricATitle }} ↔ {{ item.metricBTitle }}
                  </router-link>
                  <span class="list-row__meta">{{ enumLabel('strengthLabel', item.strengthLabel) }}</span>
                </div>
                <div class="list-row__aside">
                  <Badge>{{ formatCorrelation(item.correlationValue) }}</Badge>
                  <span>n={{ item.sampleSize }}</span>
                </div>
              </li>
            </ul>
          </DashboardPanel>
        </Card>
      </div>

      <Card padding="lg" elevated>
        <DashboardPanel
          :title="t('dashboard.insightsTitle')"
          link-to="/insights"
          :link-text="t('dashboard.viewAllInsights')"
        >
          <EmptyState
            v-if="!dashboard.insightsFeed.hasReports"
            :title="t('dashboard.noInsights')"
            :description="t('dashboard.insightsHint')"
          >
            <template #action>
              <Button variant="dark" :loading="generatingInsights" @click="runInsightsGeneration">
                {{ generatingInsights ? t('dashboard.generatingInsights') : t('dashboard.generateInsights') }}
              </Button>
            </template>
          </EmptyState>
          <template v-else>
            <InsightReportPanel
              v-for="report in dashboard.insightsFeed.reports"
              :key="report.id"
              :report="report"
              compact
            />
          </template>
        </DashboardPanel>
      </Card>

      <div class="bento-row bento-row--split">
        <Card padding="lg" elevated>
          <DashboardPanel :title="t('dashboard.recentEntries')">
            <EmptyState v-if="dashboard.recentEntries.length === 0" :title="t('journal.empty')" />
            <ul v-else class="list-rows">
              <li v-for="entry in dashboard.recentEntries" :key="entry.id" class="list-row">
                <div class="list-row__main">
                  <router-link :to="`/journal/${entry.id}`" class="list-row__title">
                    {{ entry.summaryText ?? enumLabel('processingStatus', entry.processingStatus) }}
                  </router-link>
                  <span class="list-row__meta">{{ entry.entryDate }}</span>
                </div>
              </li>
            </ul>
          </DashboardPanel>
        </Card>

        <Card padding="lg" elevated>
          <DashboardPanel :title="t('dashboard.topMetrics')">
            <EmptyState v-if="dashboard.topMetrics.length === 0" :title="t('metrics.empty')" />
            <ul v-else class="list-rows">
              <li v-for="metric in dashboard.topMetrics" :key="metric.id" class="list-row">
                <div class="list-row__main">
                  <router-link :to="`/metrics/${metric.id}`" class="list-row__title">
                    {{ metric.title }}
                  </router-link>
                  <span class="list-row__meta">{{ t('metrics.cardObservations', { count: metric.observationCount }) }}</span>
                </div>
                <div class="list-row__aside">
                  {{ metric.latestValueDisplay ?? t('common.dash') }}
                </div>
              </li>
            </ul>
          </DashboardPanel>
        </Card>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.chart-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.chart-label {
  font-size: var(--text-small);
  color: var(--color-text-secondary);
}

.chart-select {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  padding: 0.45rem 0.9rem;
  background: var(--color-surface);
  color: var(--color-text-primary);
  min-width: 10rem;
}

.chart {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  height: 280px;
  overflow: hidden;
}

@media (min-width: 900px) {
  .chart {
    height: 340px;
  }
}
</style>
