<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { MetricDefinitionListItem, MetricObservationItem } from '@metrixify/shared-types';
import MetricObservationsTable from '../components/MetricObservationsTable.vue';
import { archiveMetric, fetchMetric, fetchMetricObservations, updateMetric } from '../api/metrics';
import { useAppLocale } from '../composables/useAppLocale';
import AppShell from '../components/ui/AppShell.vue';
import Button from '../components/ui/Button.vue';
import Card from '../components/ui/Card.vue';
import ErrorState from '../components/ui/ErrorState.vue';
import LoadingState from '../components/ui/LoadingState.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import PageStack from '../components/ui/PageStack.vue';
import SectionBlock from '../components/ui/SectionBlock.vue';
import TagChip from '../components/ui/TagChip.vue';

const { t, formatDateTime, enumLabel } = useAppLocale();
const route = useRoute();

const metric = ref<MetricDefinitionListItem | null>(null);
const observations = ref<MetricObservationItem[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const saving = ref(false);
const archiving = ref(false);

const title = ref('');
const description = ref('');
const aliasesText = ref('');
const tagsText = ref('');

const isArchived = computed(() => metric.value?.status === 'archived');

async function load(id: string) {
  loading.value = true;
  error.value = null;
  try {
    const [metricData, observationsData] = await Promise.all([
      fetchMetric(id),
      fetchMetricObservations({ metricId: id }),
    ]);
    metric.value = metricData;
    observations.value = observationsData.items ?? [];
    title.value = metric.value.title;
    description.value = metric.value.description ?? '';
    aliasesText.value = metric.value.aliases.join(', ');
    tagsText.value = metric.value.tags.join(', ');
  } catch (e) {
    metric.value = null;
    observations.value = [];
    error.value = e instanceof Error ? e.message : 'Failed to load';
  } finally {
    loading.value = false;
  }
}

function formatScale(item: MetricDefinitionListItem): string {
  if (item.valueType === 'ordinal' && item.scaleMax !== null) {
    const min = item.scaleMin ?? 1;
    return `${min}–${item.scaleMax}`;
  }
  return t('common.dash');
}

async function saveChanges() {
  if (!metric.value || isArchived.value) {
    return;
  }

  saving.value = true;
  error.value = null;
  try {
    const aliases = aliasesText.value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const tags = tagsText.value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    metric.value = await updateMetric(metric.value.id, {
      title: title.value.trim(),
      description: description.value.trim() ? description.value.trim() : null,
      aliases,
      tags,
    });
    aliasesText.value = metric.value.aliases.join(', ');
    tagsText.value = metric.value.tags.join(', ');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to save';
  } finally {
    saving.value = false;
  }
}

async function archiveCurrentMetric() {
  if (!metric.value || isArchived.value) {
    return;
  }

  archiving.value = true;
  error.value = null;
  try {
    metric.value = await archiveMetric(metric.value.id);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to archive';
  } finally {
    archiving.value = false;
  }
}

function onObservationUpdated(updated: MetricObservationItem) {
  observations.value = observations.value.map((obs) => (obs.id === updated.id ? updated : obs));
}

function onObservationDeleted(observationId: string) {
  observations.value = observations.value.filter((obs) => obs.id !== observationId);
  if (metric.value) {
    metric.value = {
      ...metric.value,
      observationCount: Math.max(0, metric.value.observationCount - 1),
    };
  }
}

onMounted(() => {
  const id = route.params.id;
  if (typeof id === 'string') {
    load(id);
  }
});

watch(
  () => route.params.id,
  (id) => {
    if (typeof id === 'string') {
      load(id);
    }
  },
);
</script>

<template>
  <AppShell>
    <PageStack>
      <PageHeader :title="t('metrics.detailTitle')" :tagline="metric?.title">
        <template #actions>
          <router-link to="/metrics" class="back-link">{{ t('nav.backToMetrics') }}</router-link>
        </template>
      </PageHeader>

      <LoadingState v-if="loading" :message="t('metrics.loading')" />
      <ErrorState v-else-if="error && !metric" :message="error" />
      <Card v-else-if="metric" padding="lg" elevated>
      <dl class="detail">
        <dt>{{ t('metrics.colKey') }}</dt>
        <dd><code>{{ metric.key }}</code></dd>
        <dt>{{ t('metrics.colType') }}</dt>
        <dd>{{ enumLabel('metricValueType', metric.valueType) }}</dd>
        <dt>{{ t('metrics.colUnitScale') }}</dt>
        <dd>{{ metric.unit ?? formatScale(metric) }}</dd>
        <dt v-if="metric.tags.length">{{ t('metrics.tags') }}</dt>
        <dd v-if="metric.tags.length" class="tag-row">
          <TagChip v-for="tag in metric.tags" :key="tag" :label="tag" />
        </dd>
        <dt>{{ t('metrics.colCount') }}</dt>
        <dd>{{ metric.observationCount }}</dd>
        <dt>{{ t('metrics.colLastObserved') }}</dt>
        <dd>{{ formatDateTime(metric.lastObservedAt) }}</dd>
        <dt>{{ t('metrics.colStatus') }}</dt>
        <dd>{{ enumLabel('metricStatus', metric.status) }}</dd>
      </dl>

      <p v-if="isArchived" class="text-muted archived-note">{{ t('metrics.archived') }}</p>

      <form class="metric-form" @submit.prevent="saveChanges">
        <h2 class="typo-h3">{{ t('metrics.editTitle') }}</h2>

        <label class="metric-form__field">
          <span>{{ t('metrics.titleLabel') }}</span>
          <input v-model="title" type="text" :disabled="isArchived" required />
        </label>

        <label class="metric-form__field">
          <span>{{ t('metrics.descriptionLabel') }}</span>
          <textarea v-model="description" rows="3" :disabled="isArchived" />
        </label>

        <label class="metric-form__field">
          <span>{{ t('metrics.tagsLabel') }}</span>
          <input
            v-model="tagsText"
            type="text"
            :disabled="isArchived"
            placeholder="mood, mental-health, sleep"
          />
        </label>

        <label class="metric-form__field">
          <span>{{ t('metrics.aliasesLabel') }}</span>
          <input
            v-model="aliasesText"
            type="text"
            :disabled="isArchived"
            placeholder="Mood, Energy level"
          />
        </label>

        <ErrorState v-if="error" :message="error" />

        <div class="metric-form__actions">
          <Button type="submit" variant="green" :loading="saving" :disabled="isArchived">
            {{ saving ? t('metrics.saving') : t('metrics.save') }}
          </Button>
          <Button
            type="button"
            variant="destructive"
            :loading="archiving"
            :disabled="isArchived"
            @click="archiveCurrentMetric"
          >
            {{ archiving ? t('metrics.archiving') : t('metrics.archive') }}
          </Button>
        </div>
      </form>

      <SectionBlock :title="`${t('metrics.observations')} (${observations.length})`">
        <p v-if="observations.length === 0" class="text-muted">{{ t('metrics.noObservations') }}</p>
        <MetricObservationsTable
          v-else
          :items="observations"
          :show-metric="false"
          editable
          @updated="onObservationUpdated"
          @deleted="onObservationDeleted"
        />
      </SectionBlock>
    </Card>
    </PageStack>
  </AppShell>
</template>

<style scoped>
.back-link {
  font-size: var(--text-small);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
}

.detail {
  display: grid;
  grid-template-columns: minmax(7rem, auto) 1fr;
  gap: var(--space-2) var(--space-4);
  margin: 0;
}

.detail dt {
  margin: 0;
  font-size: var(--text-caption);
  font-weight: var(--font-weight-semibold);
  letter-spacing: var(--letter-spacing-body);
  color: var(--color-text-secondary);
}

.detail dd {
  margin: 0;
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.archived-note {
  margin-top: var(--space-4);
}

.metric-form {
  margin-top: var(--space-8);
  display: grid;
  gap: var(--space-4);
}

.metric-form__field {
  display: grid;
  gap: var(--space-2);
}

.metric-form__field span {
  font-size: var(--text-small);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.metric-form__field input,
.metric-form__field textarea {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface-muted);
  color: var(--color-text-primary);
}

.metric-form__field input:focus-visible,
.metric-form__field textarea:focus-visible {
  outline: 2px solid var(--color-ai);
  outline-offset: 2px;
}

.metric-form__field input:disabled,
.metric-form__field textarea:disabled {
  opacity: 0.55;
  background: var(--color-surface-muted);
}

.metric-form__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
</style>
