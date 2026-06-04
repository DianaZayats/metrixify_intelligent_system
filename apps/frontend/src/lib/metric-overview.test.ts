import { describe, expect, it } from 'vitest';
import type { MetricObservationItem } from '@metrixify/shared-types';
import {
  computeMetricActivityBadge,
  resolveMetricIconCategory,
} from './metric-overview';

function obs(metricId: string, daysAgo: number): MetricObservationItem {
  const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return {
    id: `${metricId}-${daysAgo}`,
    entryId: 'entry',
    metricDefinitionId: metricId,
    metricKey: 'k',
    metricTitle: 'T',
    valueType: 'number',
    unit: null,
    scaleMin: null,
    scaleMax: null,
    valueNumber: 1,
    valueText: null,
    valueBoolean: null,
    valueDisplay: '1',
    confidence: null,
    evidenceText: null,
    observedAt: date.toISOString(),
    observedAtPrecision: 'date_only',
    narrativeOrder: null,
    createdAt: date.toISOString(),
  };
}

describe('metric-overview', () => {
  it('maps tags and keys to icon categories', () => {
    expect(resolveMetricIconCategory('sleep_hours', [])).toBe('sleep');
    expect(resolveMetricIconCategory('caffeine_cups', [])).toBe('nutrition');
    expect(resolveMetricIconCategory('', ['nutrition', 'habits'])).toBe('nutrition');
    expect(resolveMetricIconCategory('', ['unknown'])).toBe('default');
  });

  it('computes activity badge from 7-day observation counts', () => {
    const badge = computeMetricActivityBadge(
      [obs('m1', 1), obs('m1', 2), obs('m1', 10)],
      'm1',
    );
    expect(badge).toEqual({ direction: 'up', percent: 100 });
  });
});
