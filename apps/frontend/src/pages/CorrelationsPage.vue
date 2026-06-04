<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import type { CorrelationListItem, CorrelationsListResponse } from '@metrixify/shared-types';
import { fetchCorrelations, recalculateAnalytics } from '../api/analytics';
import { useAppLocale } from '../composables/useAppLocale';
import { getEChartsThemeColors, useEChartsChart } from '../composables/useEChartsTheme';
import AppShell from '../components/ui/AppShell.vue';
import Badge from '../components/ui/Badge.vue';
import Button from '../components/ui/Button.vue';
import Card from '../components/ui/Card.vue';
import CollapsibleSection from '../components/ui/CollapsibleSection.vue';
import CorrelationPairList from '../components/correlations/CorrelationPairList.vue';
import DataTable from '../components/ui/DataTable.vue';
import EmptyState from '../components/ui/EmptyState.vue';
import ErrorState from '../components/ui/ErrorState.vue';
import LoadingState from '../components/ui/LoadingState.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import PageStack from '../components/ui/PageStack.vue';

const { t, formatDateTime, enumLabel } = useAppLocale();

type LagFilter = 'all' | '-1' | '0' | '1';

const data = ref<CorrelationsListResponse | null>(null);
const loading = ref(true);
const recalculating = ref(false);
const error = ref<string | null>(null);
const analyzeNotice = ref<string | null>(null);
const method = ref<'pearson' | 'spearman'>('pearson');
const lagFilter = ref<LagFilter>('all');
const heatmapEl = ref<HTMLElement | null>(null);
const { setOption, resize } = useEChartsChart(heatmapEl);

const items = computed(() => {
  const list = data.value?.items ?? [];
  return [...list].sort((a, b) => Math.abs(b.correlationValue) - Math.abs(a.correlationValue));
});

const heatmapLagHint = computed(() => {
  if (data.value?.heatmap.lagDays === null) {
    return t('correlations.heatmapBestLagHint');
  }
  return t('correlations.heatmapHint');
});

const heatmapSummary = computed(() => {
  const heatmap = data.value?.heatmap;
  if (!heatmap) {
    return null;
  }

  const strongest = items.value.reduce<CorrelationListItem | null>((best, item) => {
    if (!best || Math.abs(item.correlationValue) > Math.abs(best.correlationValue)) {
      return item;
    }
    return best;
  }, null);

  return {
    metricCount: heatmap.metricIds.length,
    pairCount: items.value.length,
    strongest,
  };
});

const comparisonHint = computed(() =>
  method.value === 'pearson' ? t('correlations.comparisonPearsonHint') : t('correlations.comparisonSpearmanHint'),
);

const timingHint = computed(() => {
  if (lagFilter.value === 'all') {
    return t('correlations.timingAllLagsHint');
  }
  if (lagFilter.value === '-1') {
    return t('correlations.timingBMFirstHint');
  }
  if (lagFilter.value === '1') {
    return t('correlations.timingAMFirstHint');
  }
  if (lagFilter.value === '0') {
    return t('correlations.timingSameDayHint');
  }
  return t('correlations.timingSameDayHint');
});

function formatLagLabel(lag: number): string {
  if (lag > 0) {
    return `+${lag}`;
  }
  return String(lag);
}

const axisLabelStyle = computed(() => {
  const colors = getEChartsThemeColors();
  return {
    color: colors.textTertiary,
    fontSize: 10,
    fontFamily: colors.fontFamily,
  };
});

function shortAxisLabel(label: string, maxLen = 10): string {
  const trimmed = label.trim();
  const firstWord = trimmed.split(/\s+/)[0] ?? trimmed;
  if (firstWord.length <= maxLen) {
    return firstWord;
  }
  return `${firstWord.slice(0, maxLen - 1)}…`;
}

const heatmapLegendColors = computed(() => {
  const colors = getEChartsThemeColors();
  return [colors.correlationWeak, colors.aiPale, colors.correlationStrong];
});

const FAQ_ITEMS = [
  { q: 'purposeQ', a: 'purposeA' },
  { q: 'howSearchQ', a: 'howSearchA', example: 'howSearchExample' },
  { q: 'pairsQ', a: 'pairsA' },
  { q: 'heatmapQ', a: 'heatmapA' },
  { q: 'readMapQ', a: 'readMapA' },
  { q: 'numbersQ', a: 'numbersA', example: 'numbersExample' },
  { q: 'filtersQ', a: 'filtersA' },
  { q: 'limitsQ', a: 'limitsA' },
] as const;

function faqText(suffix: string): string {
  return t(`correlations.faq.${suffix}`);
}

async function loadCorrelations() {
  loading.value = true;
  error.value = null;
  try {
    data.value = await fetchCorrelations({
      method: method.value,
      ...(lagFilter.value !== 'all' ? { lagDays: Number(lagFilter.value) } : {}),
    });
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
      analyzeNotice.value = t('correlations.analyzeResultEmpty');
    } else {
      analyzeNotice.value = t('correlations.analyzeResult', {
        count: result.correlationCount,
        official: result.officialCount,
        exploratory: result.exploratoryCount,
      });
    }
    await loadCorrelations();
    await nextTick();
    renderHeatmap();
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('common.error');
  } finally {
    recalculating.value = false;
  }
}

function formatCorrelation(value: number): string {
  return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

function renderHeatmap() {
  const heatmap = data.value?.heatmap;
  if (!heatmap || heatmap.metricIds.length === 0) {
    return;
  }

  const colors = getEChartsThemeColors();
  const size = heatmap.metricIds.length;
  const heatmapData: Array<[number, number, number | null]> = [];

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (col < row) {
        heatmapData.push([col, row, null]);
        continue;
      }
      if (col === row) {
        heatmapData.push([col, row, 0]);
        continue;
      }
      const raw = heatmap.values[row * size + col];
      heatmapData.push([col, row, raw === null ? null : Math.abs(raw)]);
    }
  }

  setOption({
    backgroundColor: 'transparent',
    textStyle: { color: colors.textPrimary, fontFamily: colors.fontFamily },
    tooltip: {
      position: 'top',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      padding: [12, 16],
      extraCssText: 'border-radius: 12px; box-shadow: 0 8px 24px rgba(12, 13, 16, 0.08);',
      textStyle: { color: colors.textPrimary, fontSize: 12 },
      formatter(params: { data?: [number, number, number | null] }) {
        const point = params.data;
        if (!point) {
          return '';
        }
        const [x, y, strength] = point;
        const labelA = heatmap.metricLabels[y] ?? '';
        const labelB = heatmap.metricLabels[x] ?? '';
        if (x === y) {
          return `${labelA}<br/>${t('correlations.tooltipSelf')}`;
        }
        if (strength === null) {
          return `${labelA}<br/>${labelB}<br/>${t('correlations.noData')}`;
        }
        const correlation = heatmap.values[y * size + x];
        if (correlation === null) {
          return `${labelA}<br/>${labelB}<br/>${t('correlations.noData')}`;
        }
        const cellLag = heatmap.cellLagDays?.[y * size + x];
        const lagLine =
          heatmap.lagDays === null && cellLag !== null && cellLag !== undefined
            ? `<br/>${t('correlations.tooltipLag', { lag: formatLagLabel(cellLag) })}`
            : '';
        const direction =
          correlation >= 0
            ? t('correlations.legendTogether')
            : t('correlations.legendOpposite');
        return `${labelA} · ${labelB}<br/>${direction}: ${formatCorrelation(correlation)}${lagLine}`;
      },
    },
    grid: { left: 8, right: 24, top: 16, bottom: 32, containLabel: true },
    xAxis: {
      type: 'category',
      data: heatmap.metricLabels,
      splitArea: { show: true },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        ...axisLabelStyle.value,
        interval: 0,
        margin: 12,
        formatter: (value: string) => shortAxisLabel(value),
      },
    },
    yAxis: {
      type: 'category',
      data: heatmap.metricLabels,
      splitArea: { show: true },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        ...axisLabelStyle.value,
        align: 'right',
        margin: 8,
        width: 112,
        overflow: 'truncate',
      },
    },
    visualMap: {
      show: false,
      min: 0,
      max: 1,
      calculable: false,
      inRange: {
        color: [colors.correlationWeak, colors.aiPale, colors.correlationStrong],
      },
      outOfRange: {
        color: 'transparent',
      },
    },
    series: [
      {
        type: 'heatmap',
        data: heatmapData,
        label: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0, 88, 214, 0.15)' },
        },
      },
    ],
  });
}

watch([method, lagFilter], loadCorrelations);

watch(
  () => data.value?.heatmap,
  async () => {
    await nextTick();
    renderHeatmap();
    resize();
  },
);

onMounted(async () => {
  await loadCorrelations();
  await nextTick();
  renderHeatmap();
});
</script>

<template>
  <AppShell>
    <PageStack>
      <PageHeader :title="t('correlations.title')" :tagline="t('correlations.tagline')">
        <template #actions>
          <Button
            variant="dark"
            :loading="recalculating"
            :disabled="loading"
            @click="runAnalysis"
          >
            {{ t('correlations.analyze') }}
          </Button>
        </template>
      </PageHeader>

      <Card class="disclaimer-card" variant="muted" elevated>
        <p class="disclaimer">{{ t('correlations.causationDisclaimer') }}</p>
        <p class="disclaimer">{{ t('correlations.dailyAggDisclaimer') }}</p>
      </Card>

      <Card class="filters-card" padding="lg" elevated>
      <h2 class="filters-card__title typo-h3">{{ t('correlations.filtersTitle') }}</h2>
      <div class="filters">
        <label class="filter">
          <span class="filter__label">{{ t('correlations.comparisonLabel') }}</span>
          <select v-model="method" class="filter__control">
            <option value="pearson">{{ t('correlations.comparisonPearson') }}</option>
            <option value="spearman">{{ t('correlations.comparisonSpearman') }}</option>
          </select>
          <span class="filter__hint">{{ comparisonHint }}</span>
        </label>
        <label class="filter">
          <span class="filter__label">{{ t('correlations.timingLabel') }}</span>
          <select v-model="lagFilter" class="filter__control">
            <option value="all">{{ t('correlations.timingAllLags') }}</option>
            <option value="0">{{ t('correlations.timingSameDay') }}</option>
            <option value="1">{{ t('correlations.timingAMFirst') }}</option>
            <option value="-1">{{ t('correlations.timingBMFirst') }}</option>
          </select>
          <span class="filter__hint">{{ timingHint }}</span>
        </label>
      </div>
    </Card>

    <LoadingState v-if="loading && !data" :message="t('correlations.loading')" />
    <ErrorState v-else-if="error && !data" :message="error" />

    <template v-else-if="data">
      <ErrorState v-if="error" :message="error" />
      <p v-if="analyzeNotice" class="notice-pill notice-pill--success">{{ analyzeNotice }}</p>

      <Card class="heatmap-card" padding="lg" elevated>
        <EmptyState
          v-if="data.heatmap.metricIds.length === 0"
          :title="t('correlations.empty')"
          :description="t('correlations.runAnalysisHint')"
        />
        <div v-else>
          <div class="heatmap-card__header">
            <div>
              <h2 class="heatmap-card__title typo-h3">{{ t('correlations.heatmapTitle') }}</h2>
              <p class="heatmap-card__hint">{{ heatmapLagHint }}</p>
            </div>

            <div v-if="heatmapSummary && heatmapSummary.metricCount > 0" class="heatmap-stats">
              <div class="heatmap-stat">
                <span class="heatmap-stat__label">{{ t('correlations.statMetrics') }}</span>
                <span class="heatmap-stat__value">{{ heatmapSummary.metricCount }}</span>
              </div>
              <div class="heatmap-stat">
                <span class="heatmap-stat__label">{{ t('correlations.statPairs') }}</span>
                <span class="heatmap-stat__value">{{ heatmapSummary.pairCount }}</span>
              </div>
              <div class="heatmap-stat heatmap-stat--wide">
                <span class="heatmap-stat__label">{{ t('correlations.statStrongest') }}</span>
                <span v-if="heatmapSummary.strongest" class="heatmap-stat__value heatmap-stat__value--sm">
                  <router-link :to="`/correlations/${heatmapSummary.strongest.id}`">
                    {{ heatmapSummary.strongest.metricATitle }} ·
                    {{ heatmapSummary.strongest.metricBTitle }}
                  </router-link>
                  <Badge class="heatmap-stat__badge">{{ formatCorrelation(heatmapSummary.strongest.correlationValue) }}</Badge>
                </span>
                <span v-else class="heatmap-stat__value">{{ t('correlations.statStrongestEmpty') }}</span>
              </div>
            </div>
          </div>

          <div
            ref="heatmapEl"
            class="heatmap"
            role="img"
            :aria-label="t('correlations.heatmapTitle')"
          />
          <div class="heatmap-legend" aria-hidden="true">
            <span class="heatmap-legend__label">{{ t('correlations.legendLess') }}</span>
            <div class="heatmap-legend__swatches">
              <span
                v-for="(color, index) in heatmapLegendColors"
                :key="index"
                class="heatmap-legend__swatch"
                :style="{ backgroundColor: color }"
              />
            </div>
            <span class="heatmap-legend__label">{{ t('correlations.legendMore') }}</span>
          </div>
        </div>
      </Card>

      <div class="correlations-sections">
        <section v-if="items.length > 0" class="ranked-section">
          <header class="ranked-section__header">
            <h2 class="typo-h3">{{ t('correlations.rankedListTitle') }}</h2>
            <p class="text-muted">{{ t('correlations.rankedListHint') }}</p>
          </header>
          <CorrelationPairList :items="items" :limit="15" />
        </section>

        <CollapsibleSection
          :title="t('correlations.debugTablesTitle')"
          :subtitle="t('correlations.debugTablesHint', { count: items.length })"
        >
          <EmptyState v-if="items.length === 0" :title="t('correlations.empty')" />
          <DataTable v-else compact sticky-header>
            <thead>
              <tr>
                <th>{{ t('correlations.colMetricA') }}</th>
                <th>{{ t('correlations.colMetricB') }}</th>
                <th>{{ t('correlations.colMethod') }}</th>
                <th>{{ t('correlations.colLag') }}</th>
                <th>{{ t('correlations.colR') }}</th>
                <th>{{ t('correlations.colStrength') }}</th>
                <th>{{ t('correlations.colSample') }}</th>
                <th>{{ t('correlations.colUpdated') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in items" :key="item.id">
                <td :data-label="t('correlations.colMetricA')">
                  <router-link :to="`/correlations/${item.id}`">{{ item.metricATitle }}</router-link>
                </td>
                <td :data-label="t('correlations.colMetricB')">{{ item.metricBTitle }}</td>
                <td :data-label="t('correlations.colMethod')">{{ enumLabel('correlationMethod', item.method) }}</td>
                <td :data-label="t('correlations.colLag')">
                  <Badge class="lag-badge">{{ formatLagLabel(item.lagDays) }}</Badge>
                </td>
                <td :data-label="t('correlations.colR')" class="cell-num">
                  <Badge>{{ formatCorrelation(item.correlationValue) }}</Badge>
                </td>
                <td :data-label="t('correlations.colStrength')">{{ enumLabel('strengthLabel', item.strengthLabel) }}</td>
                <td :data-label="t('correlations.colSample')" class="cell-num">
                  {{ item.sampleSize }}
                  <span class="text-muted">({{ enumLabel('sampleTier', item.sampleTier) }})</span>
                  <Badge v-if="item.exploratory" class="exploratory-badge">
                    {{ t('correlations.exploratoryBadge') }}
                  </Badge>
                </td>
                <td :data-label="t('correlations.colUpdated')">{{ formatDateTime(item.calculatedAt) }}</td>
              </tr>
            </tbody>
          </DataTable>
        </CollapsibleSection>

        <CollapsibleSection
          :title="t('correlations.faqTitle')"
          :subtitle="t('correlations.faqSubtitle')"
        >
          <div class="correlations-faq">
            <article v-for="(item, index) in FAQ_ITEMS" :key="item.q" class="faq-item">
              <h3 class="faq-item__question typo-h3">
                <span class="faq-item__index">{{ index + 1 }}</span>
                {{ faqText(item.q) }}
              </h3>
              <p class="faq-item__answer">{{ faqText(item.a) }}</p>
              <p v-if="item.example" class="faq-item__example">
                {{ faqText(item.example) }}
              </p>
            </article>
          </div>
        </CollapsibleSection>
      </div>
    </template>
    </PageStack>
  </AppShell>
</template>

<style scoped>
.disclaimer-card {
  /* spacing via PageStack */
}

.disclaimer {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--text-small);
}

.disclaimer + .disclaimer {
  margin-top: var(--space-2);
}

.filters-card {
  /* spacing via PageStack */
}

.filters-card__title {
  margin: 0 0 var(--space-4);
}

.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: var(--space-5);
}

.filter {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.filter__label {
  font-size: var(--text-small);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.filter__control {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  padding: 0.55rem 0.9rem;
  background: var(--color-surface-muted);
  color: var(--color-text-primary);
}

.filter__hint {
  font-size: var(--text-caption);
  color: var(--color-text-tertiary);
  line-height: var(--line-height-normal);
}

.heatmap-card {
  /* spacing via PageStack */
}

.heatmap-card__header {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  margin-bottom: var(--space-5);
}

@media (min-width: 768px) {
  .heatmap-card__header {
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }
}

.heatmap-card__title {
  margin: 0 0 var(--space-2);
}

.heatmap-card__hint {
  margin: 0;
  font-size: var(--text-small);
  max-width: 36rem;
  color: var(--color-text-secondary);
}

.heatmap-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  width: 100%;
  max-width: 100%;
}

.heatmap {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 280px;
  overflow: hidden;
}

@media (min-width: 768px) {
  .heatmap {
    min-height: 360px;
  }
}

.heatmap-stat {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
}

.heatmap-stat--wide {
  grid-column: 1 / -1;
}

.heatmap-stat__label {
  font-size: var(--text-caption);
  color: var(--color-text-tertiary);
}

.heatmap-stat__value {
  font-size: var(--text-body);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.heatmap-stat__value--sm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-small);
  font-weight: var(--font-weight-medium);
}

.heatmap-stat__value--sm a {
  color: var(--color-ai);
  text-decoration: none;
}

.heatmap-stat__value--sm a:hover {
  text-decoration: underline;
}

.heatmap-stat__badge {
  background: var(--color-ai-pale);
  color: var(--color-ai);
  border: 1px solid var(--color-ai-soft);
}

.heatmap-legend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.heatmap-legend__label {
  font-size: var(--text-caption);
  color: var(--color-text-secondary);
}

.heatmap-legend__swatches {
  display: flex;
  gap: 3px;
}

.heatmap-legend__swatch {
  width: 28px;
  height: 10px;
  border-radius: var(--radius-sm);
}

.exploratory-badge {
  margin-left: var(--space-2);
}

.lag-badge {
  font-variant-numeric: tabular-nums;
  min-width: 2.25rem;
  justify-content: center;
}

.correlations-sections {
  display: flex;
  flex-direction: column;
  gap: var(--dashboard-gap);
}

.ranked-section__header {
  margin-bottom: var(--space-4);
}

.ranked-section__header h2 {
  margin: 0 0 var(--space-2);
}

.ranked-section__header p {
  margin: 0;
  font-size: var(--text-small);
}

.correlations-faq {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.faq-item__question {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  margin: 0 0 var(--space-3);
  font-size: var(--text-body);
}

.faq-item__index {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--radius-pill);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-semibold);
}

.faq-item__answer {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: var(--line-height-relaxed);
}

.faq-item__example {
  margin: var(--space-3) 0 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-ai);
  background: var(--color-ai-pale);
  color: var(--color-text-primary);
  font-size: var(--text-small);
  line-height: var(--line-height-relaxed);
}
</style>
