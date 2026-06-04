import { describe, expect, it } from 'vitest';
import { selectTopCorrelationsForInsights } from './insights-context.js';

describe('selectTopCorrelationsForInsights', () => {
  const metricA = {
    id: 'a',
    key: 'sleep_hours',
    title: 'Sleep',
    titleI18n: null,
  } as const;
  const metricB = {
    id: 'b',
    key: 'caffeine_cups',
    title: 'Caffeine',
    titleI18n: null,
  } as const;

  it('keeps strongest absolute correlation per metric pair', () => {
    const rows = [
      {
        id: '1',
        metricAId: 'a',
        metricBId: 'b',
        correlationValue: 0.4,
        metricA,
        metricB,
      },
      {
        id: '2',
        metricAId: 'a',
        metricBId: 'b',
        correlationValue: -0.8,
        metricA,
        metricB,
      },
    ] as never[];

    const selected = selectTopCorrelationsForInsights(rows);
    expect(selected).toHaveLength(1);
    expect(selected[0]?.id).toBe('2');
  });

  it('sorts pairs by absolute correlation descending', () => {
    const metricC = { id: 'c', key: 'mood', title: 'Mood', titleI18n: null } as const;
    const rows = [
      {
        id: '1',
        metricAId: 'a',
        metricBId: 'b',
        correlationValue: 0.3,
        metricA,
        metricB,
      },
      {
        id: '2',
        metricAId: 'a',
        metricBId: 'c',
        correlationValue: 0.9,
        metricA,
        metricB: metricC,
      },
    ] as never[];

    const selected = selectTopCorrelationsForInsights(rows);
    expect(selected.map((row) => row.id)).toEqual(['2', '1']);
  });
});
