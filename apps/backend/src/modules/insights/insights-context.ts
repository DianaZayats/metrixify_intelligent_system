import type { CorrelationResult, MetricDefinition } from '@prisma/client';
import type { AppLocale } from '@metrixify/shared-types';
import { MIN_CORRELATION_SAMPLE } from '@metrixify/analytics-core';
import { resolveMetricTitle } from '../metrics/metric.mapper.js';
import { listActiveProfileFactsForUser } from '../profile-facts/profile-fact.repository.js';
import { parseValueJsonText } from '../profile-facts/profile-fact-deduplication.js';
import {
  getLatestCorrelationCalculatedAt,
  listCorrelationResults,
} from '../analytics/analytics.repository.js';
import type { InsightsGenerationContextPack } from './insights.schemas.js';

export const MAX_INSIGHT_CORRELATIONS = 25;
export const MAX_PROFILE_FACTS = 30;

function pairKey(metricAId: string, metricBId: string): string {
  return metricAId < metricBId ? `${metricAId}:${metricBId}` : `${metricBId}:${metricAId}`;
}

export function selectTopCorrelationsForInsights(
  rows: (CorrelationResult & { metricA: MetricDefinition; metricB: MetricDefinition })[],
  maxItems = MAX_INSIGHT_CORRELATIONS,
): (CorrelationResult & { metricA: MetricDefinition; metricB: MetricDefinition })[] {
  const byPair = new Map<
    string,
    CorrelationResult & { metricA: MetricDefinition; metricB: MetricDefinition }
  >();

  for (const row of rows) {
    const key = pairKey(row.metricAId, row.metricBId);
    const existing = byPair.get(key);
    if (!existing || Math.abs(row.correlationValue) > Math.abs(existing.correlationValue)) {
      byPair.set(key, row);
    }
  }

  return [...byPair.values()]
    .sort((a, b) => Math.abs(b.correlationValue) - Math.abs(a.correlationValue))
    .slice(0, maxItems);
}

export async function buildInsightsGenerationContextPack(params: {
  userId: string;
  locale: AppLocale;
  timezone: string;
}): Promise<{
  context: InsightsGenerationContextPack;
  correlationCalculatedAt: Date | null;
}> {
  const [profileFacts, correlationRows, correlationCalculatedAt] = await Promise.all([
    listActiveProfileFactsForUser(params.userId, MAX_PROFILE_FACTS),
    listCorrelationResults(params.userId),
    getLatestCorrelationCalculatedAt(params.userId),
  ]);

  const selectedCorrelations = selectTopCorrelationsForInsights(correlationRows);

  return {
    correlationCalculatedAt,
    context: {
      schema_version: '1',
      user: {
        locale: params.locale,
        timezone: params.timezone,
      },
      profile_facts: profileFacts.map((fact) => ({
        key: fact.key,
        value_text: parseValueJsonText(fact.valueJson),
        fact_type: fact.factType,
        stability: fact.stability === 'temporary' ? 'evolving' : fact.stability,
      })),
      correlations: selectedCorrelations.map((row, refIndex) => {
        const metadata = row.metadataJson as { exploratory?: boolean } | null;
        const exploratory =
          metadata?.exploratory === true || row.sampleSize < MIN_CORRELATION_SAMPLE;

        return {
          ref_index: refIndex,
          correlation_id: row.id,
          metric_a_key: row.metricA.key,
          metric_a_title: resolveMetricTitle(row.metricA, params.locale),
          metric_b_key: row.metricB.key,
          metric_b_title: resolveMetricTitle(row.metricB, params.locale),
          method: row.method,
          lag_days: row.lagDays,
          sample_size: row.sampleSize,
          correlation_value: row.correlationValue,
          strength_label: row.strengthLabel,
          exploratory,
        };
      }),
    },
  };
}
