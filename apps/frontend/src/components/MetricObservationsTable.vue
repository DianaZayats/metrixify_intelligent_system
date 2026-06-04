<script setup lang="ts">
import type { MetricObservationItem } from '@metrixify/shared-types';
import ObservationEditInline from './ObservationEditInline.vue';
import { useAppLocale } from '../composables/useAppLocale';
import Badge from './ui/Badge.vue';
import DataTable from './ui/DataTable.vue';

withDefaults(
  defineProps<{
    items: MetricObservationItem[];
    showMetric?: boolean;
    editable?: boolean;
  }>(),
  {
    showMetric: true,
    editable: false,
  },
);

const emit = defineEmits<{
  updated: [observation: MetricObservationItem];
  deleted: [observationId: string];
}>();

const { t, formatDateTime, enumLabel } = useAppLocale();

function rawValue(obs: MetricObservationItem): string {
  if (obs.valueBoolean !== null) {
    return String(obs.valueBoolean);
  }
  if (obs.valueNumber !== null) {
    return String(obs.valueNumber);
  }
  if (obs.valueText !== null) {
    return obs.valueText;
  }
  return t('common.dash');
}
</script>

<template>
  <div class="observations">
    <ul class="obs-cards" :aria-label="t('metrics.allObservations', { count: items.length })">
      <li v-for="obs in items" :key="obs.id">
        <article class="obs-card">
          <header class="obs-card__header">
            <span class="obs-card__value">{{ obs.valueDisplay }}</span>
            <Badge variant="ai">{{ enumLabel('metricValueType', obs.valueType) }}</Badge>
          </header>
          <p v-if="showMetric !== false" class="obs-card__metric">
            <router-link :to="`/metrics/${obs.metricDefinitionId}`">{{ obs.metricTitle }}</router-link>
          </p>
          <p class="obs-card__date text-small">{{ formatDateTime(obs.observedAt) }}</p>
          <p v-if="obs.evidenceText" class="obs-card__evidence">{{ obs.evidenceText }}</p>
          <footer class="obs-card__footer text-caption">
            <router-link :to="`/journal/${obs.entryId}`">{{ t('metrics.viewEntry') }}</router-link>
          </footer>
          <ObservationEditInline
            v-if="editable"
            compact
            :observation="obs"
            @updated="emit('updated', $event)"
            @deleted="emit('deleted', $event)"
          />
        </article>
      </li>
    </ul>

    <DataTable class="obs-table" compact sticky-header>
      <thead>
        <tr>
          <th>{{ t('metrics.colDate') }}</th>
          <th v-if="showMetric !== false">{{ t('metrics.colTitle') }}</th>
          <th>{{ t('metrics.colValue') }}</th>
          <th class="hide-tablet">{{ t('metrics.colRaw') }}</th>
          <th class="hide-tablet">{{ t('metrics.colType') }}</th>
          <th class="hide-tablet">{{ t('metrics.colTimeline') }}</th>
          <th class="hide-tablet">{{ t('profileFacts.colConfidence') }}</th>
          <th>{{ t('metrics.colEvidence') }}</th>
          <th v-if="editable">{{ t('metrics.colActions') }}</th>
          <th>{{ t('metrics.colEntry') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="obs in items" :key="obs.id">
          <td class="cell-mono" :data-label="t('metrics.colDate')">{{ formatDateTime(obs.observedAt) }}</td>
          <td v-if="showMetric !== false" :data-label="t('metrics.colTitle')">
            <router-link :to="`/metrics/${obs.metricDefinitionId}`">{{ obs.metricTitle }}</router-link>
            <code class="cell-key">{{ obs.metricKey }}</code>
          </td>
          <td class="cell-value" :data-label="t('metrics.colValue')">{{ obs.valueDisplay }}</td>
          <td class="cell-mono hide-tablet" :data-label="t('metrics.colRaw')">{{ rawValue(obs) }}</td>
          <td class="hide-tablet" :data-label="t('metrics.colType')">
            {{ enumLabel('metricValueType', obs.valueType) }}
          </td>
          <td class="cell-mono hide-tablet" :data-label="t('metrics.colTimeline')">
            <span v-if="obs.observedAtPrecision">
              {{ enumLabel('observedAtPrecision', obs.observedAtPrecision) }}
            </span>
            <span v-else class="text-muted">{{ t('common.dash') }}</span>
            <span v-if="obs.narrativeOrder != null" class="cell-sub"> #{{ obs.narrativeOrder }} </span>
          </td>
          <td class="cell-num hide-tablet" :data-label="t('profileFacts.colConfidence')">
            {{ obs.confidence != null ? obs.confidence.toFixed(2) : t('common.dash') }}
          </td>
          <td class="cell-evidence" :data-label="t('metrics.colEvidence')">
            {{ obs.evidenceText ?? t('common.dash') }}
          </td>
          <td class="row-actions" :data-label="t('metrics.colEntry')">
            <router-link :to="`/journal/${obs.entryId}`">{{ t('metrics.viewEntry') }}</router-link>
          </td>
          <td v-if="editable" class="row-actions" :data-label="t('metrics.colActions')">
            <ObservationEditInline
              compact
              :observation="obs"
              @updated="emit('updated', $event)"
              @deleted="emit('deleted', $event)"
            />
          </td>
        </tr>
      </tbody>
    </DataTable>
  </div>
</template>

<style scoped>
.obs-cards {
  display: none;
  list-style: none;
  margin: 0;
  padding: 0;
  gap: var(--space-3);
}

.obs-card {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.obs-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.obs-card__value {
  font-size: var(--text-h3);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
}

.obs-card__metric {
  margin: 0 0 var(--space-1);
  font-weight: var(--font-weight-medium);
}

.obs-card__date {
  margin: 0 0 var(--space-2);
}

.obs-card__evidence {
  margin: 0 0 var(--space-3);
  font-size: var(--text-small);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}

.obs-card__footer {
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

@media (max-width: 767px) {
  .obs-cards {
    display: grid;
  }

  .obs-table {
    display: none;
  }
}

.cell-key {
  display: block;
  margin-top: var(--space-1);
  font-size: var(--text-caption);
  opacity: 0.85;
  word-break: break-all;
}

.cell-value {
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
}

.cell-mono {
  font-size: var(--text-small);
}

.cell-sub {
  display: block;
  font-size: var(--text-caption);
  color: var(--color-text-secondary);
}

.cell-evidence {
  max-width: 18rem;
  font-size: var(--text-small);
  color: var(--color-text-secondary);
  line-height: var(--line-height-normal);
}
</style>
