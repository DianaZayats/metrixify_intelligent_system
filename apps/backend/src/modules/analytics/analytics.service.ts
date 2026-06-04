import { computeAllCorrelations, type MetricSeriesInput } from '@metrixify/analytics-core';
import type { AppLocale, RecalculateResponse } from '@metrixify/shared-types';
import { ApiError } from '../../shared/errors/api-error.js';
import { findUserById } from '../users/user.repository.js';
import type { CorrelationsQuery, DashboardQuery } from './analytics.schemas.js';
import {
  buildCorrelationDetailPayload,
  buildDailySeriesForMetric,
  buildDashboardResponse,
  formatLatestObservationDisplay,
  toCorrelationListItem,
  toCorrelationsListResponse,
  toDashboardCorrelationHighlights,
  toDashboardMetricCards,
} from './analytics.mapper.js';
import { getDashboardInsightsFeed } from '../insights/insights.service.js';
import {
  countCorrelationResults,
  countEntriesLast7Days,
  findAlternateCorrelationResult,
  findCorrelationResultById,
  findEntriesByIds,
  getLatestCorrelationCalculatedAt,
  listActiveAnalyticsMetrics,
  listAllObservationsForAnalytics,
  listCorrelationResults,
  listDistinctEntryIdsForMetrics,
  listRecentEntriesForDashboard,
  replaceUserCorrelationResults,
} from './analytics.repository.js';

async function getUserTimezone(userId: string): Promise<string> {
  const user = await findUserById(userId);
  return user?.timezone ?? 'UTC';
}

export async function recalculateAnalyticsForUser(userId: string): Promise<RecalculateResponse> {
  const timezone = await getUserTimezone(userId);
  const definitions = await listActiveAnalyticsMetrics(userId);
  const observations = await listAllObservationsForAnalytics(userId);

  const byMetric = new Map<string, MetricSeriesInput['observations']>();
  const valueTypeByMetric = new Map<string, MetricSeriesInput['valueType']>();

  for (const definition of definitions) {
    valueTypeByMetric.set(definition.id, definition.valueType);
    byMetric.set(definition.id, []);
  }

  for (const observation of observations) {
    const bucket = byMetric.get(observation.metricDefinitionId);
    if (!bucket) {
      continue;
    }
    bucket.push({
      observedAt: observation.observedAt,
      valueNumber: observation.valueNumber,
      valueBoolean: observation.valueBoolean,
    });
  }

  const metrics: MetricSeriesInput[] = definitions.map((definition) => ({
    metricId: definition.id,
    valueType: definition.valueType,
    observations: byMetric.get(definition.id) ?? [],
  }));

  const computed = computeAllCorrelations(metrics, timezone);
  await replaceUserCorrelationResults(userId, computed);
  const calculatedAt = (await getLatestCorrelationCalculatedAt(userId)) ?? new Date();
  const officialCount = computed.filter((item) => !item.exploratory).length;
  const exploratoryCount = computed.filter((item) => item.exploratory).length;

  return {
    correlationCount: computed.length,
    officialCount,
    exploratoryCount,
    calculatedAt: calculatedAt.toISOString(),
  };
}

export async function getAnalyticsDashboard(userId: string, query: DashboardQuery, locale: AppLocale) {
  const timezone = await getUserTimezone(userId);
  const [entriesLast7Days, recentEntries, topMetricsRaw, correlationRows, hasResults, lastCalculatedAt, observations, insightsFeed] =
    await Promise.all([
      countEntriesLast7Days(userId, timezone),
      listRecentEntriesForDashboard(userId),
      toDashboardMetricCards(userId, locale),
      listCorrelationResults(userId, { method: 'pearson', lagDays: 0 }),
      countCorrelationResults(userId).then((n) => n > 0),
      getLatestCorrelationCalculatedAt(userId),
      listAllObservationsForAnalytics(userId),
      getDashboardInsightsFeed(userId, locale),
    ]);

  const correlationItems = correlationRows.map((row) => toCorrelationListItem(row, locale));
  const topCorrelations = toDashboardCorrelationHighlights(correlationItems);

  let chartMetricId = query.chartMetricId ?? topMetricsRaw[0]?.id ?? null;
  if (chartMetricId && !topMetricsRaw.some((m) => m.id === chartMetricId)) {
    chartMetricId = topMetricsRaw[0]?.id ?? null;
  }

  const chartSeries =
    chartMetricId !== null
      ? buildDailySeriesForMetric(observations, chartMetricId, timezone)
      : [];

  const latestByMetric = new Map<string, (typeof observations)[0]>();
  for (const observation of observations) {
    if (!latestByMetric.has(observation.metricDefinitionId)) {
      latestByMetric.set(observation.metricDefinitionId, observation);
    }
  }

  const topMetrics = topMetricsRaw.map((metric) => {
    const latest = latestByMetric.get(metric.id);
    const definition = latest?.metricDefinition;
    return {
      ...metric,
      latestValueDisplay:
        latest && definition
          ? formatLatestObservationDisplay(latest, definition)
          : null,
    };
  });

  return buildDashboardResponse({
    entriesLast7Days,
    hasCorrelationResults: hasResults,
    lastCalculatedAt,
    recentEntries: recentEntries.map((entry) => ({
      id: entry.id,
      entryDate: entry.entryDate.toISOString().slice(0, 10),
      summaryText: entry.summaryText,
      processingStatus: entry.processingStatus,
    })),
    topMetrics,
    topCorrelations,
    chartMetricId,
    chartSeries,
    insightsFeed,
  });
}

export async function getAnalyticsCorrelations(
  userId: string,
  query: CorrelationsQuery,
  locale: AppLocale,
) {
  const method = query.method ?? 'pearson';
  const rows = await listCorrelationResults(userId, {
    method: query.method,
    lagDays: query.lagDays,
    minSample: query.minSample,
  });
  return toCorrelationsListResponse(rows, locale, method, query.lagDays);
}

export async function getAnalyticsCorrelationById(userId: string, id: string, locale: AppLocale) {
  const row = await findCorrelationResultById(userId, id);
  if (!row) {
    throw new ApiError(404, 'NOT_FOUND', 'Correlation not found');
  }

  const timezone = await getUserTimezone(userId);
  const observations = await listAllObservationsForAnalytics(userId);
  const alternateMethod = row.method === 'pearson' ? 'spearman' : 'pearson';
  const alternate = await findAlternateCorrelationResult({
    userId,
    metricAId: row.metricAId,
    metricBId: row.metricBId,
    lagDays: row.lagDays,
    method: alternateMethod,
  });

  const entryIds = await listDistinctEntryIdsForMetrics(userId, [row.metricAId, row.metricBId]);
  const relatedEntries = await findEntriesByIds(userId, entryIds);

  return buildCorrelationDetailPayload({
    row,
    locale,
    timezone,
    observations,
    alternateMethodValue: alternate?.correlationValue ?? null,
    relatedEntries,
  });
}
