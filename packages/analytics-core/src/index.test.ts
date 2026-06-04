import { describe, expect, it } from 'vitest';
import {
  aggregateDailySeries,
  alignPairedSeries,
  computeAllCorrelations,
  correlatePair,
  MIN_CORRELATION_SAMPLE,
  pearsonCorrelation,
  sampleTier,
  spearmanCorrelation,
  strengthLabelFromR,
} from './index.js';

describe('pearsonCorrelation', () => {
  it('returns perfect positive correlation', () => {
    const r = pearsonCorrelation([1, 2, 3], [2, 4, 6]);
    expect(r).toBeCloseTo(1, 5);
  });

  it('returns null for insufficient samples', () => {
    expect(pearsonCorrelation([1], [2])).toBeNull();
  });
});

describe('spearmanCorrelation', () => {
  it('returns perfect rank correlation for monotonic data', () => {
    const r = spearmanCorrelation([1, 2, 3, 4, 5], [10, 20, 30, 40, 50]);
    expect(r).toBeCloseTo(1, 5);
  });
});

describe('aggregateDailySeries', () => {
  it('averages ordinal values on the same calendar day', () => {
    const series = aggregateDailySeries(
      [
        { observedAt: new Date('2026-05-19T08:00:00.000Z'), valueNumber: 2, valueBoolean: null },
        { observedAt: new Date('2026-05-19T20:00:00.000Z'), valueNumber: 4, valueBoolean: null },
      ],
      'ordinal',
      'UTC',
    );
    expect(series).toEqual([{ date: '2026-05-19', value: 3 }]);
  });

  it('sums number values on the same calendar day', () => {
    const series = aggregateDailySeries(
      [
        { observedAt: new Date('2026-05-19T10:00:00.000Z'), valueNumber: 20, valueBoolean: null },
        { observedAt: new Date('2026-05-19T18:00:00.000Z'), valueNumber: 15, valueBoolean: null },
      ],
      'number',
      'UTC',
    );
    expect(series).toEqual([{ date: '2026-05-19', value: 35 }]);
  });

  it('uses any-true for boolean daily aggregation', () => {
    const series = aggregateDailySeries(
      [
        { observedAt: new Date('2026-05-19T10:00:00.000Z'), valueNumber: null, valueBoolean: false },
        { observedAt: new Date('2026-05-19T18:00:00.000Z'), valueNumber: null, valueBoolean: true },
      ],
      'boolean',
      'UTC',
    );
    expect(series).toEqual([{ date: '2026-05-19', value: 1 }]);
  });
});

describe('alignPairedSeries', () => {
  it('aligns with lag 0 on matching dates', () => {
    const a = [{ date: '2026-05-01', value: 1 }, { date: '2026-05-02', value: 2 }];
    const b = [{ date: '2026-05-01', value: 3 }, { date: '2026-05-02', value: 4 }];
    const { xs, ys } = alignPairedSeries(a, b, 0);
    expect(xs).toEqual([1, 2]);
    expect(ys).toEqual([3, 4]);
  });

  it('aligns with lag -1 day', () => {
    const a = [{ date: '2026-05-02', value: 2 }];
    const b = [{ date: '2026-05-01', value: 5 }];
    const { xs, ys } = alignPairedSeries(a, b, -1);
    expect(xs).toEqual([2]);
    expect(ys).toEqual([5]);
  });
});

describe('strengthLabelFromR and sampleTier', () => {
  it('maps strength bands', () => {
    expect(strengthLabelFromR(0.75)).toBe('strong');
    expect(strengthLabelFromR(0.45)).toBe('moderate');
    expect(strengthLabelFromR(0.25)).toBe('weak');
    expect(strengthLabelFromR(0.05)).toBe('negligible');
  });

  it('maps sample tiers', () => {
    expect(sampleTier(MIN_CORRELATION_SAMPLE)).toBe('low');
    expect(sampleTier(25)).toBe('medium');
    expect(sampleTier(40)).toBe('higher');
  });
});

describe('computeAllCorrelations', () => {
  it('skips pairs below minimum sample size', () => {
    const observations = Array.from({ length: 10 }, (_, i) => ({
      observedAt: new Date(`2026-05-${String(i + 1).padStart(2, '0')}T12:00:00.000Z`),
      valueNumber: i + 1,
      valueBoolean: null,
    }));

    const results = computeAllCorrelations(
      [
        { metricId: 'a', valueType: 'ordinal', observations },
        { metricId: 'b', valueType: 'ordinal', observations: observations.map((o) => ({ ...o, valueNumber: o.valueNumber! + 1 })) },
      ],
      'UTC',
      { minSample: MIN_CORRELATION_SAMPLE },
    );

    expect(results).toHaveLength(0);
  });

  it('computes correlations for sufficient paired days', () => {
    const days = Array.from({ length: MIN_CORRELATION_SAMPLE }, (_, i) => i + 1);
    const observationsA = days.map((d) => ({
      observedAt: new Date(`2026-05-${String(d).padStart(2, '0')}T12:00:00.000Z`),
      valueNumber: d,
      valueBoolean: null,
    }));
    const observationsB = days.map((d) => ({
      observedAt: new Date(`2026-05-${String(d).padStart(2, '0')}T12:00:00.000Z`),
      valueNumber: d * 2,
      valueBoolean: null,
    }));

    const results = computeAllCorrelations(
      [
        { metricId: 'a', valueType: 'ordinal', observations: observationsA },
        { metricId: 'b', valueType: 'ordinal', observations: observationsB },
      ],
      'UTC',
    );

    expect(results.length).toBeGreaterThan(0);
    const pearsonLag0 = results.find((r) => r.method === 'pearson' && r.lagDays === 0);
    expect(pearsonLag0?.correlationValue).toBeCloseTo(1, 5);
  });
});

describe('correlatePair', () => {
  it('returns null when sample is too small', () => {
    const series = [{ date: '2026-05-01', value: 1 }];
    expect(
      correlatePair({ seriesA: series, seriesB: series, lagDays: 0, method: 'pearson' }),
    ).toBeNull();
  });
});
