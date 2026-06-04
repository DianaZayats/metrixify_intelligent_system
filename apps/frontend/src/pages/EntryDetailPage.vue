<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { DiaryEntryDetail, MetricObservationItem } from '@metrixify/shared-types';
import { fetchDashboard, recalculateAnalytics } from '../api/analytics';
import { fetchEntry, reprocessEntryMetrics } from '../api/entries';
import { useAppLocale } from '../composables/useAppLocale';
import ObservationEditInline from '../components/ObservationEditInline.vue';
import AppShell from '../components/ui/AppShell.vue';
import Button from '../components/ui/Button.vue';
import Card from '../components/ui/Card.vue';
import ErrorState from '../components/ui/ErrorState.vue';
import LoadingState from '../components/ui/LoadingState.vue';
import PageHeader from '../components/ui/PageHeader.vue';
import PageStack from '../components/ui/PageStack.vue';
import SectionBlock from '../components/ui/SectionBlock.vue';

const { t, formatDateTime, enumLabel } = useAppLocale();
const route = useRoute();
const entry = ref<DiaryEntryDetail | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const reprocessing = ref(false);
const recalculating = ref(false);
const showSatisfactionPrompt = ref(false);
const notice = ref<string | null>(null);
const hadCorrelationsBeforeReprocess = ref(false);
const satisfactionPromptEl = ref<HTMLElement | null>(null);

const hasReprocessableText = computed(() =>
  Boolean(entry.value?.rawText?.trim() || entry.value?.transcriptText?.trim()),
);

const reprocessBusy = computed(() => reprocessing.value || recalculating.value);

const showEntryProcessingError = computed(
  () =>
    Boolean(entry.value?.processingError) &&
    entry.value?.processingStatus !== 'completed',
);

async function load(id: string) {
  loading.value = true;
  error.value = null;
  showSatisfactionPrompt.value = false;
  notice.value = null;
  try {
    entry.value = await fetchEntry(id);
  } catch (e) {
    entry.value = null;
    error.value = e instanceof Error ? e.message : 'Failed to load';
  } finally {
    loading.value = false;
  }
}

async function handleReprocess() {
  if (!entry.value || !hasReprocessableText.value || reprocessBusy.value) {
    return;
  }

  if (!window.confirm(t('entry.reprocessConfirm'))) {
    return;
  }

  reprocessing.value = true;
  error.value = null;
  notice.value = null;
  showSatisfactionPrompt.value = false;

  try {
    const dashboard = await fetchDashboard();
    hadCorrelationsBeforeReprocess.value = dashboard.hasCorrelationResults;
    entry.value = await reprocessEntryMetrics(entry.value.id);
    if (hadCorrelationsBeforeReprocess.value) {
      showSatisfactionPrompt.value = true;
      await nextTick();
      satisfactionPromptEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      notice.value = t('entry.reprocessSuccess', { count: entry.value.observations.length });
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('entry.reprocessFailed');
    await load(String(route.params.id));
  } finally {
    reprocessing.value = false;
  }
}

async function acceptMetricsAndRecalculate() {
  showSatisfactionPrompt.value = false;
  recalculating.value = true;
  error.value = null;
  notice.value = t('entry.recalculatingCorrelations');
  try {
    const result = await recalculateAnalytics();
    notice.value =
      result.correlationCount === 0 ? t('entry.recalculateEmpty') : t('entry.recalculateDone');
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('common.error');
    notice.value = null;
  } finally {
    recalculating.value = false;
  }
}

function dismissSatisfactionPrompt() {
  showSatisfactionPrompt.value = false;
  notice.value = null;
}

function onObservationUpdated(updated: MetricObservationItem) {
  if (!entry.value) {
    return;
  }
  entry.value = {
    ...entry.value,
    observations: entry.value.observations.map((obs) => (obs.id === updated.id ? updated : obs)),
  };
  notice.value = t('observationEdit.saveSuccess');
}

function onObservationDeleted(observationId: string) {
  if (!entry.value) {
    return;
  }
  entry.value = {
    ...entry.value,
    observations: entry.value.observations.filter((obs) => obs.id !== observationId),
  };
  notice.value = t('observationEdit.deleteSuccess');
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
      <PageHeader :title="t('entry.title')" :tagline="t('entry.tagline')">
        <template #actions>
          <Button
            v-if="entry && hasReprocessableText"
            class="entry-reprocess-btn"
            variant="secondary"
            size="sm"
            :loading="reprocessing"
            :disabled="reprocessBusy"
            @click="handleReprocess"
          >
            {{ t('entry.reprocessMetrics') }}
          </Button>
          <router-link to="/journal" class="back-link">{{ t('nav.backToJournal') }}</router-link>
        </template>
      </PageHeader>

      <LoadingState v-if="loading" :message="t('entry.loading')" />
      <ErrorState v-else-if="error && !entry" :message="error" />
      <template v-else-if="entry">
      <div v-if="reprocessing" class="entry-banner entry-banner--progress" role="status">
        <LoadingState :message="t('entry.reprocessInProgress')" />
      </div>
      <div v-else-if="recalculating" class="entry-banner entry-banner--progress" role="status">
        <LoadingState :message="t('entry.recalculatingCorrelations')" />
      </div>

      <div v-if="error" class="entry-notice">
        <ErrorState :message="error" />
      </div>
      <p v-else-if="notice && !showSatisfactionPrompt" class="notice-pill notice-pill--success">
        {{ notice }}
      </p>

      <div v-if="showSatisfactionPrompt" ref="satisfactionPromptEl">
        <Card
          class="entry-satisfaction"
          padding="lg"
          elevated
          role="dialog"
          :aria-label="t('entry.satisfactionPrompt')"
        >
          <h2 class="entry-satisfaction__heading">{{ t('entry.satisfactionHeading') }}</h2>
          <p class="entry-satisfaction__text">{{ t('entry.satisfactionPrompt') }}</p>
          <div class="entry-satisfaction__actions">
            <Button variant="green" size="sm" :loading="recalculating" @click="acceptMetricsAndRecalculate">
              {{ t('entry.satisfactionYesRecalculate') }}
            </Button>
            <Button variant="ghost" size="sm" :disabled="recalculating" @click="dismissSatisfactionPrompt">
              {{ t('entry.satisfactionNo') }}
            </Button>
          </div>
        </Card>
      </div>

      <Card padding="lg" elevated :class="{ 'entry-card--busy': reprocessing }">
        <dl class="detail">
          <dt>{{ t('entry.date') }}</dt>
          <dd>{{ entry.entryDate }}</dd>
          <dt>{{ t('entry.status') }}</dt>
          <dd>{{ enumLabel('processingStatus', entry.processingStatus) }}</dd>
          <dt>{{ t('entry.source') }}</dt>
          <dd>{{ enumLabel('sourceType', entry.sourceType) }}</dd>
          <dt>{{ t('entry.created') }}</dt>
          <dd>{{ formatDateTime(entry.createdAt) }}</dd>
          <dt>{{ t('entry.summary') }}</dt>
          <dd class="detail__text">{{ entry.summaryText ?? t('common.dash') }}</dd>
          <dt>{{ entry.sourceType === 'voice' ? t('entry.transcript') : t('entry.fullText') }}</dt>
          <dd class="detail__text detail__text--secondary">
            {{ entry.transcriptText ?? entry.rawText ?? t('common.dash') }}
          </dd>
          <template v-if="entry.processingStatus === 'summarizing'">
            <dt>{{ t('entry.status') }}</dt>
            <dd class="text-muted">{{ t('entry.summaryInProgress') }}</dd>
          </template>
          <template v-else-if="entry.sourceType === 'voice' && entry.processingStatus === 'transcribing'">
            <dt>{{ t('entry.status') }}</dt>
            <dd class="text-muted">{{ t('entry.transcriptionInProgress') }}</dd>
          </template>
          <template v-if="showEntryProcessingError">
            <dt>{{ t('entry.error') }}</dt>
            <dd class="detail__error">{{ entry.processingError }}</dd>
          </template>
        </dl>

        <SectionBlock
          v-if="entry.observations.length > 0"
          :title="t('entry.extractedMetrics')"
          class="entry-metrics"
        >
          <p v-if="reprocessing" class="entry-metrics__updating text-muted">
            {{ t('entry.metricsUpdatingHint') }}
          </p>
          <ul class="list-rows entry-metrics__list" :class="{ 'entry-metrics__list--dimmed': reprocessing }">
            <li v-for="obs in entry.observations" :key="obs.id" class="list-row entry-metrics__item">
              <div class="list-row__main">
                <span class="list-row__label">{{ obs.metricTitle }}</span>
                <span class="list-row__meta">
                  {{ obs.valueDisplay }}
                  <span v-if="obs.unit"> · {{ obs.unit }}</span>
                  · {{ formatDateTime(obs.observedAt) }}
                </span>
                <p v-if="obs.evidenceText" class="entry-metrics__evidence text-muted">"{{ obs.evidenceText }}"</p>
                <p v-if="obs.confidence != null" class="text-muted entry-metrics__meta">
                  {{ t('entry.confidence', { value: obs.confidence.toFixed(2) }) }}
                  <span v-if="obs.observedAtPrecision">
                    · {{ enumLabel('observedAtPrecision', obs.observedAtPrecision) }}
                  </span>
                  <span v-if="obs.narrativeOrder != null">
                    · {{ t('entry.order', { value: obs.narrativeOrder }) }}
                  </span>
                </p>
              </div>
              <ObservationEditInline
                :observation="obs"
                @updated="onObservationUpdated"
                @deleted="onObservationDeleted"
              />
            </li>
          </ul>
        </SectionBlock>
        <p v-else-if="entry.processingStatus === 'extracting_metrics' || reprocessing" class="text-muted">
          {{ t('entry.extractingMetrics') }}
        </p>
      </Card>
      </template>
    </PageStack>
  </AppShell>
</template>

<style scoped>
.back-link {
  font-size: var(--text-small);
  font-weight: var(--font-weight-medium);
  text-decoration: none;
}

.entry-reprocess-btn {
  margin-right: var(--space-3);
}

.entry-notice {
  margin-bottom: var(--space-4);
}

.entry-notice--success {
  margin: 0 0 var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-positive-soft, color-mix(in srgb, var(--color-positive) 12%, transparent));
  color: var(--color-text-primary);
  font-size: var(--text-small);
}

.entry-banner {
  margin-bottom: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
  background: var(--color-primary-soft);
}

.entry-banner--progress :deep(.loading) {
  padding: 0;
}

.entry-card--busy {
  opacity: 0.72;
  pointer-events: none;
}

.entry-satisfaction {
  margin-bottom: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  border: 2px solid var(--color-primary);
  background: color-mix(in srgb, var(--color-primary-soft) 80%, var(--color-surface));
  box-shadow: var(--shadow-md, 0 8px 24px color-mix(in srgb, var(--color-primary) 16%, transparent));
}

.entry-satisfaction__heading {
  margin: 0;
  font-size: var(--text-h3);
  color: var(--color-text-primary);
}

.entry-satisfaction__text {
  margin: 0;
}

.entry-satisfaction__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
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

.detail__text {
  white-space: pre-wrap;
  line-height: var(--line-height-relaxed);
}

.detail__text--secondary {
  color: var(--color-text-secondary);
}

.detail__error {
  color: var(--color-negative);
}

.entry-metrics__updating {
  margin: 0 0 var(--space-3);
  font-size: var(--text-small);
}

.entry-metrics__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--space-3);
}

.entry-metrics__list--dimmed {
  opacity: 0.55;
}

.entry-metrics__item {
  padding: var(--space-4);
  background: var(--color-primary-soft);
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--color-primary) 12%, transparent);
}

.entry-metrics__title {
  display: block;
  margin-bottom: var(--space-1);
  color: var(--color-text-primary);
}

.entry-metrics__value {
  font-size: var(--text-h3);
  font-weight: var(--font-weight-semibold);
  color: var(--color-primary);
}

.entry-metrics__unit {
  margin-left: var(--space-2);
}

.entry-metrics__time {
  margin: var(--space-2) 0 0;
}

.entry-metrics__evidence {
  margin: var(--space-2) 0 0;
  font-size: var(--text-small);
  color: var(--color-text-secondary);
  font-style: italic;
}

.entry-metrics__meta {
  margin: var(--space-2) 0 0;
  font-size: var(--text-caption);
}
</style>
