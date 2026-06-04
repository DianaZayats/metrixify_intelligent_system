import type { CorrelationResult, MetricDefinition } from '@prisma/client';
import type {
  AppLocale,
  CorrelationDetail,
  CorrelationHeatmap,
  CorrelationListItem,
  CorrelationsListResponse,
  DailySeriesPoint,
  DashboardCorrelationHighlight,
  DashboardInsightsFeed,
  DashboardMetricCard,
  DashboardResponse,
  ScatterPoint,
} from '@metrixify/shared-types';
import type { CorrelationMethod } from '@metrixify/shared-types';
import {
  aggregateDailySeries,
  alignPairedSeries,
  MIN_CORRELATION_SAMPLE,
  type RawObservation,
} from '@metrixify/analytics-core';
import { formatObservationValue, resolveMetricTitle } from '../metrics/metric.mapper.js';
import { listMetricDefinitionsWithStats } from '../metrics/metric.repository.js';

export function toCorrelationListItem(
  row: CorrelationResult & { metricA: MetricDefinition; metricB: MetricDefinition },
  locale: AppLocale,
): CorrelationListItem {
  const metadata = row.metadataJson as { exploratory?: boolean } | null;
  const exploratory =
    metadata?.exploratory === true || row.sampleSize < MIN_CORRELATION_SAMPLE;

  return {
    id: row.id,
    metricAId: row.metricAId,
    metricAKey: row.metricA.key,
    metricATitle: resolveMetricTitle(row.metricA, locale),
    metricBId: row.metricBId,
    metricBKey: row.metricB.key,
    metricBTitle: resolveMetricTitle(row.metricB, locale),
    method: row.method,
    lagDays: row.lagDays,
    sampleSize: row.sampleSize,
    correlationValue: row.correlationValue,
    strengthLabel: row.strengthLabel,
    sampleTier:
      row.sampleSize >= 40 ? 'higher' : row.sampleSize >= 20 ? 'medium' : 'low',
    exploratory,
    calculatedAt: row.calculatedAt.toISOString(),
  };
}

export function buildHeatmap(
  items: CorrelationListItem[],
  method: CorrelationMethod,
  lagDays: number,
): CorrelationHeatmap {
  const filtered = items.filter((item) => item.method === method && item.lagDays === lagDays);
  return buildHeatmapFromItems(filtered, method, lagDays);
}

function pairKey(metricAId: string, metricBId: string): string {
  return [metricAId, metricBId].sort().join('::');
}

/** One entry per metric pair: strongest |r| across lag −1, 0, +1. */
export function buildBestLagHeatmap(
  items: CorrelationListItem[],
  method: CorrelationMethod,
): CorrelationHeatmap {
  const filtered = items.filter((item) => item.method === method);
  const bestByPair = new Map<string, CorrelationListItem>();

  for (const item of filtered) {
    const key = pairKey(item.metricAId, item.metricBId);
    const existing = bestByPair.get(key);
    if (
      !existing ||
      Math.abs(item.correlationValue) > Math.abs(existing.correlationValue)
    ) {
      bestByPair.set(key, item);
    }
  }

  return buildHeatmapFromItems([...bestByPair.values()], method, null);
}

function buildHeatmapFromItems(
  items: CorrelationListItem[],
  method: CorrelationMethod,
  lagDays: number | null,
): CorrelationHeatmap {
  const metricMap = new Map<string, string>();

  for (const item of items) {
    metricMap.set(item.metricAId, item.metricATitle);
    metricMap.set(item.metricBId, item.metricBTitle);
  }

  const metricIds = [...metricMap.keys()].sort((a, b) =>
    (metricMap.get(a) ?? a).localeCompare(metricMap.get(b) ?? b),
  );
  const indexById = new Map(metricIds.map((id, index) => [id, index]));
  const size = metricIds.length;
  const values: Array<number | null> = Array.from({ length: size * size }, () => null);
  const cellLagDays: Array<number | null> = Array.from({ length: size * size }, () => null);

  for (let i = 0; i < size; i += 1) {
    values[i * size + i] = 1;
    cellLagDays[i * size + i] = lagDays;
  }

  for (const item of items) {
    const i = indexById.get(item.metricAId);
    const j = indexById.get(item.metricBId);
    if (i === undefined || j === undefined) {
      continue;
    }
    values[i * size + j] = item.correlationValue;
    values[j * size + i] = item.correlationValue;
    cellLagDays[i * size + j] = item.lagDays;
    cellLagDays[j * size + i] = item.lagDays;
  }

  return {
    metricIds,
    metricLabels: metricIds.map((id) => metricMap.get(id) ?? id),
    values,
    cellLagDays,
    method,
    lagDays,
  };
}

export function toCorrelationsListResponse(
  rows: Array<CorrelationResult & { metricA: MetricDefinition; metricB: MetricDefinition }>,
  locale: AppLocale,
  heatmapMethod: CorrelationMethod,
  heatmapLagDays: number | undefined,
): CorrelationsListResponse {
  const items = rows.map((row) => toCorrelationListItem(row, locale));
  const heatmap =
    heatmapLagDays === undefined
      ? buildBestLagHeatmap(items, heatmapMethod)
      : buildHeatmap(items, heatmapMethod, heatmapLagDays);
  return {
    items,
    heatmap,
  };
}

export async function toDashboardMetricCards(
  userId: string,
  locale: AppLocale,
): Promise<DashboardMetricCard[]> {
  const definitions = await listMetricDefinitionsWithStats(userId);
  const active = definitions
    .filter((d) => d.status === 'active')
    .sort((a, b) => b.observationCount - a.observationCount)
    .slice(0, 5);

  return active.map((definition) => ({
    id: definition.id,
    key: definition.key,
    title: resolveMetricTitle(definition, locale),
    valueType: definition.valueType,
    observationCount: definition.observationCount,
    lastObservedAt: definition.lastObservedAt?.toISOString() ?? null,
    latestValueDisplay: null,
  }));
}

export function toDashboardCorrelationHighlights(
  items: CorrelationListItem[],
): DashboardCorrelationHighlight[] {
  return items
    .filter((item) => item.method === 'pearson' && item.lagDays === 0)
    .sort((a, b) => Math.abs(b.correlationValue) - Math.abs(a.correlationValue))
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      metricATitle: item.metricATitle,
      metricBTitle: item.metricBTitle,
      correlationValue: item.correlationValue,
      method: item.method,
      lagDays: item.lagDays,
      sampleSize: item.sampleSize,
      strengthLabel: item.strengthLabel,
    }));
}

export function buildDailySeriesForMetric(
  observations: Array<{
    observedAt: Date;
    valueNumber: number | null;
    valueBoolean: boolean | null;
    metricDefinitionId: string;
    metricDefinition: MetricDefinition;
  }>,
  metricId: string,
  timezone: string,
): DailySeriesPoint[] {
  const metricObs = observations.filter((o) => o.metricDefinitionId === metricId);
  if (metricObs.length === 0) {
    return [];
  }
  const valueType = metricObs[0]!.metricDefinition.valueType;
  if (valueType === 'category') {
    return [];
  }
  const raw: RawObservation[] = metricObs.map((o) => ({
    observedAt: o.observedAt,
    valueNumber: o.valueNumber,
    valueBoolean: o.valueBoolean,
  }));
  return aggregateDailySeries(raw, valueType, timezone);
}

export function buildCorrelationDetailPayload(params: {
  row: CorrelationResult & { metricA: MetricDefinition; metricB: MetricDefinition };
  locale: AppLocale;
  timezone: string;
  observations: Array<{
    observedAt: Date;
    valueNumber: number | null;
    valueBoolean: boolean | null;
    metricDefinitionId: string;
    metricDefinition: MetricDefinition;
  }>;
  alternateMethodValue: number | null;
  relatedEntries: Array<{ id: string; entryDate: Date; summaryText: string | null }>;
}): CorrelationDetail {
  const seriesA = buildDailySeriesForMetric(params.observations, params.row.metricAId, params.timezone);
  const seriesB = buildDailySeriesForMetric(params.observations, params.row.metricBId, params.timezone);
  const aligned = alignPairedSeries(seriesA, seriesB, params.row.lagDays);
  const scatter: ScatterPoint[] = aligned.xs.map((x, index) => ({
    x,
    y: aligned.ys[index]!,
    date: aligned.dates[index]!,
  }));

  const item = toCorrelationListItem(params.row, params.locale);

  return {
    id: item.id,
    metricAId: item.metricAId,
    metricAKey: item.metricAKey,
    metricATitle: item.metricATitle,
    metricBId: item.metricBId,
    metricBKey: item.metricBKey,
    metricBTitle: item.metricBTitle,
    method: item.method,
    lagDays: item.lagDays,
    sampleSize: item.sampleSize,
    correlationValue: item.correlationValue,
    alternateMethodValue: params.alternateMethodValue,
    strengthLabel: item.strengthLabel,
    sampleTier: item.sampleTier,
    calculatedAt: item.calculatedAt,
    seriesA,
    seriesB,
    scatter,
    relatedEntries: params.relatedEntries.map((entry) => ({
      entryId: entry.id,
      entryDate: entry.entryDate.toISOString().slice(0, 10),
      summaryText: entry.summaryText,
    })),
  };
}

export function buildDashboardResponse(params: {
  entriesLast7Days: number;
  hasCorrelationResults: boolean;
  lastCalculatedAt: Date | null;
  recentEntries: DashboardResponse['recentEntries'];
  topMetrics: DashboardMetricCard[];
  topCorrelations: DashboardCorrelationHighlight[];
  chartMetricId: string | null;
  chartSeries: DailySeriesPoint[];
  insightsFeed: DashboardInsightsFeed;
}): DashboardResponse {
  return {
    entriesLast7Days: params.entriesLast7Days,
    hasCorrelationResults: params.hasCorrelationResults,
    lastCalculatedAt: params.lastCalculatedAt?.toISOString() ?? null,
    recentEntries: params.recentEntries,
    topMetrics: params.topMetrics,
    topCorrelations: params.topCorrelations,
    chartMetricId: params.chartMetricId,
    chartSeries: params.chartSeries,
    insightsFeed: params.insightsFeed,
  };
}

export function formatLatestObservationDisplay(
  observation: {
    valueNumber: number | null;
    valueText: string | null;
    valueBoolean: boolean | null;
  },
  definition: MetricDefinition,
): string {
  return formatObservationValue(observation, definition);
}
