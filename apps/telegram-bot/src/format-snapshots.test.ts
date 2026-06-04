import { describe, expect, it } from 'vitest';
import { formatCorrelationsSnapshot, formatInsightsSnapshot } from './format-snapshots.js';

describe('formatCorrelationsSnapshot', () => {
  it('formats ranked pairs with r values', () => {
    const text = formatCorrelationsSnapshot('en', {
      total: 2,
      items: [
        {
          metricATitle: 'Energy',
          metricBTitle: 'Stress',
          correlationValue: -0.91,
          lagDays: 0,
          sampleSize: 20,
          exploratory: false,
        },
      ],
    });
    expect(text).toContain('<b>Top correlations</b>');
    expect(text).toContain('Energy');
    expect(text).toContain('Stress');
    expect(text).toContain('-0.91');
  });

  it('shows empty state when no correlations', () => {
    const text = formatCorrelationsSnapshot('uk', { total: 0, items: [] });
    expect(text).toContain('Кореляції');
    expect(text).toContain('немає даних');
  });
});

describe('formatInsightsSnapshot', () => {
  it('formats insights and recommendations', () => {
    const text = formatInsightsSnapshot('en', {
      report: {
        generatedAt: '2026-05-29T10:00:00.000Z',
        insights: [
          {
            title: 'Energy drops with stress',
            body: 'Higher stress aligns with lower energy scores.',
            confidence: 'high',
          },
        ],
        recommendations: [
          {
            title: 'Track sleep',
            body: 'Log sleep hours on stressful days.',
          },
        ],
      },
    });
    expect(text).toContain('<b>Latest insights</b>');
    expect(text).toContain('Energy drops with stress');
    expect(text).toContain('<b>Recommendations</b>');
  });

  it('shows empty state when no report', () => {
    const text = formatInsightsSnapshot('uk', { report: null });
    expect(text).toContain('Інсайти');
    expect(text).toContain('Звітів ще немає');
  });
});
