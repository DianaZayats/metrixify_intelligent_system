<script setup lang="ts">
import type { CorrelationListItem } from '@metrixify/shared-types';
import { computed } from 'vue';
import { useAppLocale } from '../../composables/useAppLocale';
import Badge from '../ui/Badge.vue';

const props = withDefaults(
  defineProps<{
    items: CorrelationListItem[];
    limit?: number;
  }>(),
  {
    limit: 12,
  },
);

const { t, formatDateTime, enumLabel } = useAppLocale();

const visibleItems = computed(() => props.items.slice(0, props.limit));

function formatCorrelation(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function formatLagLabel(lag: number): string {
  if (lag > 0) {
    return `+${lag}`;
  }
  return String(lag);
}

function rBadgeVariant(value: number): 'positive' | 'negative' | 'neutral' {
  if (value >= 0.35) {
    return 'positive';
  }
  if (value <= -0.35) {
    return 'negative';
  }
  return 'neutral';
}
</script>

<template>
  <ul v-if="visibleItems.length > 0" class="pair-list">
    <li v-for="(item, index) in visibleItems" :key="item.id" class="pair-list__item">
      <router-link :to="`/correlations/${item.id}`" class="pair-card">
        <span class="pair-card__rank" aria-hidden="true">{{ index + 1 }}</span>
        <span class="pair-card__main">
          <span class="pair-card__metrics">
            {{ item.metricATitle }}
            <span class="pair-card__dot" aria-hidden="true">·</span>
            {{ item.metricBTitle }}
          </span>
          <span class="pair-card__meta text-small">
            {{ enumLabel('correlationMethod', item.method) }}
            · {{ t('correlations.colLag') }} {{ formatLagLabel(item.lagDays) }}
            · n={{ item.sampleSize }}
            <span class="text-muted">({{ enumLabel('sampleTier', item.sampleTier) }})</span>
          </span>
        </span>
        <span class="pair-card__badges">
          <Badge :variant="rBadgeVariant(item.correlationValue)">
            r {{ formatCorrelation(item.correlationValue) }}
          </Badge>
          <Badge v-if="item.exploratory" variant="warning">
            {{ t('correlations.exploratoryBadge') }}
          </Badge>
        </span>
      </router-link>
      <time class="pair-card__time text-caption" :datetime="item.calculatedAt">
        {{ formatDateTime(item.calculatedAt) }}
      </time>
    </li>
  </ul>
  <p v-else class="text-muted">{{ t('correlations.empty') }}</p>
</template>

<style scoped>
.pair-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-3);
}

.pair-list__item {
  display: grid;
  gap: var(--space-1);
}

.pair-card {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: inherit;
  text-decoration: none;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
}

.pair-card:hover {
  border-color: color-mix(in srgb, var(--color-ai) 35%, var(--color-border));
  background: var(--color-surface-muted);
  box-shadow: 0 2px 12px color-mix(in srgb, var(--color-ai) 8%, transparent);
}

.pair-card__rank {
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: var(--radius-pill);
  background: var(--color-ai-soft);
  color: var(--color-ai);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-semibold);
  flex-shrink: 0;
}

.pair-card__main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.pair-card__metrics {
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
}

.pair-card__dot {
  color: var(--color-text-tertiary);
  margin: 0 0.15em;
}

.pair-card__meta {
  color: var(--color-text-secondary);
}

.pair-card__badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}

.pair-card__time {
  padding-left: calc(1.75rem + var(--space-4) + var(--space-5));
  color: var(--color-text-tertiary);
}

@media (max-width: 767px) {
  .pair-card {
    grid-template-columns: auto 1fr;
    grid-template-rows: auto auto;
  }

  .pair-card__badges {
    grid-column: 1 / -1;
    justify-content: flex-start;
    padding-left: calc(1.75rem + var(--space-4));
  }

  .pair-card__time {
    padding-left: var(--space-5);
  }
}
</style>
