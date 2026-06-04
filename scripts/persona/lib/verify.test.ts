import { describe, expect, it } from 'vitest';
import { verifyCorrelations } from './verify.js';

describe('verifyCorrelations', () => {
  it('marks required expectation as FOUND when threshold met', () => {
    const report = verifyCorrelations({
      rows: [
        {
          id: '1',
          metricAKey: 'nuts_consumed',
          metricBKey: 'skin_rash_occurred',
          method: 'pearson',
          lagDays: 0,
          sampleSize: 20,
          correlationValue: 0.52,
        },
      ],
      required: [
        {
          metric_a: 'nuts_consumed',
          metric_b: 'skin_rash_occurred',
          method: 'pearson',
          lag_days: 0,
          min_r: 0.35,
          min_sample: 14,
        },
      ],
      optional: [],
      extraThreshold: 0.3,
    });

    expect(report.failedRequired).toBe(0);
    expect(report.expectedChecks[0]?.status).toBe('FOUND');
  });

  it('logs extras without failing when required expectations pass', () => {
    const report = verifyCorrelations({
      rows: [
        {
          id: '1',
          metricAKey: 'nuts_consumed',
          metricBKey: 'skin_rash_occurred',
          method: 'pearson',
          lagDays: 0,
          sampleSize: 20,
          correlationValue: 0.52,
        },
        {
          id: '2',
          metricAKey: 'sleep_quality',
          metricBKey: 'wellbeing',
          method: 'pearson',
          lagDays: 0,
          sampleSize: 18,
          correlationValue: 0.41,
        },
      ],
      required: [
        {
          metric_a: 'nuts_consumed',
          metric_b: 'skin_rash_occurred',
          method: 'pearson',
          lag_days: 0,
          min_r: 0.35,
          min_sample: 14,
        },
      ],
      optional: [],
      extraThreshold: 0.3,
    });

    expect(report.failedRequired).toBe(0);
    expect(report.extras.length).toBe(1);
  });
});
