<script setup lang="ts">
import type { TagVariant } from '@metrixify/design-tokens';
import type { InsightReportDetail } from '@metrixify/shared-types';
import { useAppLocale } from '../../composables/useAppLocale';
import Badge from '../ui/Badge.vue';
import Card from '../ui/Card.vue';
import EmptyState from '../ui/EmptyState.vue';

defineProps<{
  report: InsightReportDetail;
  compact?: boolean;
}>();

const { t, formatDateTime } = useAppLocale();

function confidenceVariant(confidence: string): TagVariant {
  if (confidence === 'high') {
    return 'ai';
  }
  if (confidence === 'exploratory') {
    return 'warning';
  }
  return 'neutral';
}
</script>

<template>
  <article class="report-panel">
    <header class="report-panel__header">
      <h3 class="report-panel__title">
        {{ t('insights.reportHeading', { date: formatDateTime(report.generatedAt) }) }}
      </h3>
      <p v-if="!compact" class="report-panel__meta text-muted">
        {{
          t('insights.inputSummary', {
            facts: report.inputSummary.profileFactCount,
            correlations: report.inputSummary.correlationCount,
          })
        }}
      </p>
    </header>

    <p v-if="report.disclaimer && !compact" class="report-panel__disclaimer">
      {{ report.disclaimer }}
    </p>

    <div class="report-panel__block">
      <h4>{{ t('insights.sectionInsights') }}</h4>
      <EmptyState
        v-if="report.insights.length === 0"
        :title="t('insights.noInsights')"
        :description="compact ? undefined : t('insights.noInsightsHint')"
      />
      <div v-else class="report-panel__grid" :class="{ 'report-panel__grid--compact': compact }">
        <Card v-for="insight in report.insights" :key="insight.id" variant="ai" elevated class="insight-card">
          <div class="insight-card__header">
            <h5>{{ insight.title }}</h5>
            <Badge :variant="confidenceVariant(insight.confidence)">
              {{ t(`insights.confidence.${insight.confidence}`) }}
            </Badge>
          </div>
          <p>{{ insight.body }}</p>
          <div v-if="insight.correlationIds.length" class="insight-card__links">
            <router-link
              v-for="correlationId in insight.correlationIds"
              :key="correlationId"
              :to="`/correlations/${correlationId}`"
            >
              {{ t('insights.viewCorrelation') }}
            </router-link>
          </div>
        </Card>
      </div>
    </div>

    <div class="report-panel__block">
      <h4>{{ t('insights.sectionRecommendations') }}</h4>
      <EmptyState
        v-if="report.recommendations.length === 0"
        :title="t('insights.noRecommendations')"
      />
      <div v-else class="report-panel__grid" :class="{ 'report-panel__grid--compact': compact }">
        <Card v-for="item in report.recommendations" :key="item.id" elevated class="recommendation-card">
          <h5>{{ item.title }}</h5>
          <p>{{ item.body }}</p>
        </Card>
      </div>
    </div>
  </article>
</template>

<style scoped>
.report-panel {
  display: grid;
  gap: var(--space-5);
  padding: var(--space-6);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  border: 1px solid rgba(225, 226, 221, 0.55);
}

.report-panel + .report-panel {
  /* gap handled by PageStack parent on InsightsPage */
}

.report-panel__title {
  margin: 0;
  font-size: var(--text-lg);
}

.report-panel__meta {
  margin: var(--space-2) 0 0;
  font-size: var(--text-sm);
}

.report-panel__disclaimer {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-ai-pale);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
}

.report-panel__block h4 {
  margin: 0 0 var(--space-3);
  font-size: var(--text-body);
  font-weight: var(--font-weight-semibold);
}

.report-panel__grid {
  display: grid;
  gap: var(--space-4);
}

@media (min-width: 768px) {
  .report-panel__grid:not(.report-panel__grid--compact) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.insight-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.insight-card h5,
.recommendation-card h5 {
  margin: 0;
  font-size: var(--text-body);
  font-weight: var(--font-weight-semibold);
}

.insight-card p,
.recommendation-card p {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.insight-card__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.insight-card__links a {
  color: var(--color-primary);
  font-size: var(--text-sm);
  text-decoration: none;
}

.insight-card__links a:hover {
  text-decoration: underline;
}

.recommendation-card {
  border-left: 4px solid var(--color-wellness);
}
</style>
