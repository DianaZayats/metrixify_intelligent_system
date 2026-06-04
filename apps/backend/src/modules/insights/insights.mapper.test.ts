import { describe, expect, it } from 'vitest';
import { toInsightReportDetail } from './insights.mapper.js';

describe('toInsightReportDetail', () => {
  const baseReport = {
    id: 'report-1',
    userId: 'user-1',
    locale: 'uk',
    insightsJson: [
      {
        id: 'insight-1',
        titleI18n: { en: 'Nuts and skin', uk: 'Горіхи та шкіра' },
        bodyI18n: {
          en: 'Nut intake appears linked to skin reactions in your diary.',
          uk: 'Споживання горіхів пов\'язане з реакціями шкіри у вашому щоденнику.',
        },
        confidence: 'high',
        correlationIds: ['corr-1'],
      },
    ],
    recommendationsJson: [
      {
        id: 'rec-1',
        titleI18n: { en: 'Track nuts', uk: 'Відстежуйте горіхи' },
        bodyI18n: {
          en: 'Log nut intake alongside skin reactions.',
          uk: 'Записуйте споживання горіхів разом із реакціями шкіри.',
        },
        relatedInsightIds: ['insight-1'],
      },
    ],
    disclaimer: JSON.stringify({
      en: 'Correlation is not causation.',
      uk: 'Кореляція не означає причинність.',
    }),
    inputSummaryJson: { profileFactCount: 1, correlationCount: 1 },
    correlationCalculatedAt: new Date('2026-06-02T00:00:00.000Z'),
    model: 'gpt-4o-mini',
    promptVersion: '1.2.0',
    aiRunId: null,
    generatedAt: new Date('2026-06-02T01:24:00.000Z'),
    createdAt: new Date('2026-06-02T01:24:00.000Z'),
  };

  it('returns English copy when locale is en', () => {
    const detail = toInsightReportDetail(baseReport, 'en');
    expect(detail.insights[0]?.title).toBe('Nuts and skin');
    expect(detail.recommendations[0]?.body).toContain('Log nut intake');
    expect(detail.disclaimer).toBe('Correlation is not causation.');
  });

  it('returns Ukrainian copy when locale is uk', () => {
    const detail = toInsightReportDetail(baseReport, 'uk');
    expect(detail.insights[0]?.title).toBe('Горіхи та шкіра');
    expect(detail.recommendations[0]?.body).toContain('горіхів');
    expect(detail.disclaimer).toBe('Кореляція не означає причинність.');
  });

  it('supports legacy single-language rows via duplicated fallback', () => {
    const legacy = {
      ...baseReport,
      insightsJson: [
        {
          id: 'legacy-1',
          title: 'Legacy title',
          body: 'Legacy body',
          confidence: 'medium',
          correlationIds: [],
        },
      ],
      recommendationsJson: [],
      disclaimer: 'Legacy disclaimer',
    };

    const detail = toInsightReportDetail(legacy, 'en');
    expect(detail.insights[0]?.title).toBe('Legacy title');
    expect(detail.disclaimer).toBe('Legacy disclaimer');
  });
});
