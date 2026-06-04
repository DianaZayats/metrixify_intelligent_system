<script setup lang="ts">
import type { ProfileFactListItem } from '@metrixify/shared-types';
import { classifyProfileFactReliability } from '@metrixify/shared-types';
import { useAppLocale } from '../../composables/useAppLocale';
import Badge from '../ui/Badge.vue';
import Button from '../ui/Button.vue';

defineProps<{
  items: ProfileFactListItem[];
  archivingId: string | null;
}>();

const emit = defineEmits<{
  archive: [fact: ProfileFactListItem];
}>();

const { t, formatDateTime, enumLabel } = useAppLocale();

function statusVariant(status: ProfileFactListItem['status']): 'positive' | 'neutral' {
  return status === 'active' ? 'positive' : 'neutral';
}

function reliabilityVariant(
  reliability: ProfileFactListItem['reliability'],
): 'positive' | 'warning' {
  return reliability === 'likely_fact' ? 'positive' : 'warning';
}

function factReliability(fact: ProfileFactListItem): ProfileFactListItem['reliability'] {
  return fact.reliability ?? classifyProfileFactReliability(fact.confidence, fact.evidenceCount);
}
</script>

<template>
  <ul class="fact-list">
    <li v-for="fact in items" :key="fact.id" class="fact-list__item">
      <article class="fact-card" :class="{ 'fact-card--archived': fact.status === 'archived' }">
        <header class="fact-card__header">
          <code class="fact-card__key">{{ fact.key }}</code>
          <div class="fact-card__badges">
            <Badge :variant="reliabilityVariant(factReliability(fact))">
              {{ enumLabel('factReliability', factReliability(fact)) }}
            </Badge>
            <Badge :variant="statusVariant(fact.status)">
              {{ enumLabel('metricStatus', fact.status) }}
            </Badge>
          </div>
        </header>
        <p class="fact-card__value">{{ fact.valueText }}</p>
        <dl class="fact-card__meta">
          <div>
            <dt>{{ t('profileFacts.colType') }}</dt>
            <dd>{{ enumLabel('factType', fact.factType) }}</dd>
          </div>
          <div>
            <dt>{{ t('profileFacts.colStability') }}</dt>
            <dd>{{ enumLabel('stability', fact.stability) }}</dd>
          </div>
          <div>
            <dt>{{ t('profileFacts.colConfidence') }}</dt>
            <dd>{{ fact.confidence ?? t('common.dash') }}</dd>
          </div>
          <div>
            <dt>{{ t('profileFacts.colEvidence') }}</dt>
            <dd>{{ fact.evidenceCount }}</dd>
          </div>
        </dl>
        <footer class="fact-card__footer">
          <time class="text-caption" :datetime="fact.updatedAt">
            {{ formatDateTime(fact.updatedAt) }}
          </time>
          <Button
            v-if="fact.status === 'active'"
            variant="ghost"
            size="sm"
            :loading="archivingId === fact.id"
            @click="emit('archive', fact)"
          >
            {{ archivingId === fact.id ? t('profileFacts.archiving') : t('profileFacts.archive') }}
          </Button>
        </footer>
      </article>
    </li>
  </ul>
</template>

<style scoped>
.fact-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-4);
}

@media (min-width: 768px) {
  .fact-list {
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  }
}

.fact-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  height: 100%;
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
}

.fact-card--archived {
  opacity: 0.72;
  background: var(--color-surface-muted);
}

.fact-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.fact-card__badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--space-2);
}

.fact-card__key {
  font-size: var(--text-caption);
  word-break: break-all;
}

.fact-card__value {
  margin: 0;
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-normal);
}

.fact-card__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2) var(--space-4);
  margin: 0;
}

.fact-card__meta div {
  display: grid;
  gap: 0.15rem;
}

.fact-card__meta dt {
  margin: 0;
  font-size: var(--text-caption);
  color: var(--color-text-tertiary);
}

.fact-card__meta dd {
  margin: 0;
  font-size: var(--text-small);
  color: var(--color-text-secondary);
}

.fact-card__footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}
</style>
