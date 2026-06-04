<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import type { MetricDefinitionListItem, MetricObservationItem } from '@metrixify/shared-types';
import {
  computeMetricActivityBadge,
  latestObservationForMetric,
  resolveMetricCardTheme,
  resolveMetricIconCategory,
} from '../../lib/metric-overview';
import { useAppLocale } from '../../composables/useAppLocale';
import Badge from '../ui/Badge.vue';
import MetricCategoryIcon from './MetricCategoryIcon.vue';

const props = defineProps<{
  metric: MetricDefinitionListItem;
  observations: MetricObservationItem[];
}>();

const { t } = useAppLocale();

const iconCategory = computed(() => resolveMetricIconCategory(props.metric.key, props.metric.tags));
const cardTheme = computed(() => resolveMetricCardTheme(iconCategory.value));
const cardStyle = computed<CSSProperties>(() => ({
  '--metric-card-gradient-start': cardTheme.value.start,
  '--metric-card-gradient-end': cardTheme.value.end,
  '--metric-card-fg': cardTheme.value.foreground,
  '--metric-card-icon-bg': cardTheme.value.iconBg,
}));
const latest = computed(() => latestObservationForMetric(props.observations, props.metric.id));
const activityBadge = computed(() =>
  computeMetricActivityBadge(props.observations, props.metric.id),
);
const showValue = computed(() => props.metric.valueType !== 'boolean');
const displayValue = computed(() => latest.value?.valueDisplay ?? t('common.dash'));
</script>

<template>
  <router-link
    :to="`/metrics/${metric.id}`"
    class="metric-overview-card"
    :class="{ 'metric-overview-card--boolean': !showValue }"
    :style="cardStyle"
  >
    <div class="metric-overview-card__head">
      <p class="metric-overview-card__title">{{ metric.title }}</p>
      <span class="metric-overview-card__icon">
        <MetricCategoryIcon :category="iconCategory" />
      </span>
    </div>

    <div v-if="showValue" class="metric-overview-card__value-row">
      <span class="metric-overview-card__value">{{ displayValue }}</span>
      <span v-if="metric.unit" class="metric-overview-card__unit">{{ metric.unit }}</span>
    </div>

    <div class="metric-overview-card__footer">
      <p class="metric-overview-card__meta">
        {{ t('metrics.cardObservations', { count: metric.observationCount }) }}
      </p>
      <Badge
        v-if="activityBadge"
        :variant="activityBadge.direction === 'up' ? 'positive' : 'negative'"
        class="metric-overview-card__badge"
      >
        {{ activityBadge.direction === 'up' ? '↑' : '↓' }} {{ activityBadge.percent }}%
      </Badge>
    </div>
  </router-link>
</template>

<style scoped>
.metric-overview-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  border-radius: var(--radius-lg);
  border: 1px solid transparent;
  background: linear-gradient(
    145deg,
    var(--metric-card-gradient-start) 0%,
    var(--metric-card-gradient-end) 100%
  );
  color: var(--metric-card-fg);
  text-decoration: none;
  min-height: 9.5rem;
  transition:
    box-shadow 0.15s ease,
    transform 0.15s ease;
}

.metric-overview-card:hover {
  box-shadow: 0 8px 24px rgba(12, 13, 16, 0.12);
  transform: translateY(-1px);
}

.metric-overview-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.metric-overview-card__title {
  margin: 0;
  font-size: var(--text-small);
  font-weight: var(--font-weight-medium);
  color: color-mix(in srgb, var(--metric-card-fg) 88%, transparent);
  letter-spacing: var(--letter-spacing-body);
  line-height: var(--line-height-normal);
}

.metric-overview-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
  color: var(--metric-card-fg);
  background: var(--metric-card-icon-bg);
}

.metric-overview-card__value-row {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--space-2);
  min-height: 2rem;
}

.metric-overview-card--boolean .metric-overview-card__footer {
  margin-top: auto;
}

.metric-overview-card__footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: auto;
}

.metric-overview-card__value {
  font-size: var(--text-h2);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-h2);
  line-height: var(--line-height-tight);
  color: var(--metric-card-fg);
}

.metric-overview-card__unit {
  font-size: var(--text-small);
  color: color-mix(in srgb, var(--metric-card-fg) 72%, transparent);
}

.metric-overview-card__badge {
  flex-shrink: 0;
}

.metric-overview-card :deep(.badge) {
  background: var(--metric-card-icon-bg);
  color: var(--metric-card-fg);
}

.metric-overview-card__meta {
  margin: 0;
  font-size: var(--text-caption);
  color: color-mix(in srgb, var(--metric-card-fg) 72%, transparent);
}
</style>
