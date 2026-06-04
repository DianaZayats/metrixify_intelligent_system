import { describe, expect, it } from 'vitest';
import { mapInsightsGenerationOutput } from './insights-generation.service.js';
import type { InsightsGenerationContextPack } from './insights.schemas.js';

const context: InsightsGenerationContextPack = {
  schema_version: '1',
  user: { locale: 'en', timezone: 'UTC' },
  profile_facts: [],
  correlations: [
    {
      ref_index: 0,
      correlation_id: 'corr-1',
      metric_a_key: 'sleep_hours',
      metric_a_title: 'Sleep',
      metric_b_key: 'caffeine_cups',
      metric_b_title: 'Caffeine',
      method: 'pearson',
      lag_days: 1,
      sample_size: 30,
      correlation_value: -0.62,
      strength_label: 'moderate',
      exploratory: false,
    },
  ],
};

describe('mapInsightsGenerationOutput', () => {
  it('maps correlation refs and related insight ids with bilingual fields', () => {
    const mapped = mapInsightsGenerationOutput({
      context,
      output: {
        insights: [
          {
            title_i18n: { en: 'Sleep and caffeine', uk: 'Сон і кофеїн' },
            body_i18n: {
              en: 'More caffeine tends to align with less sleep next day.',
              uk: 'Більше кофеїну частіше збігається з меншим сном наступного дня.',
            },
            confidence: 'medium',
            correlation_ref_indices: [0],
          },
        ],
        recommendations: [
          {
            title_i18n: { en: 'Track timing', uk: 'Відстежуйте час' },
            body_i18n: {
              en: 'Log caffeine time for two weeks.',
              uk: 'Записуйте час кофеїну протягом двох тижнів.',
            },
            related_insight_indices: [0],
          },
        ],
        disclaimer_i18n: {
          en: 'Patterns are exploratory.',
          uk: 'Патерни є exploratory.',
        },
      },
    });

    expect(mapped.insights).toHaveLength(1);
    expect(mapped.insights[0]?.titleI18n.uk).toBe('Сон і кофеїн');
    expect(mapped.insights[0]?.correlationIds).toEqual(['corr-1']);
    expect(mapped.recommendations[0]?.relatedInsightIds).toEqual([mapped.insights[0]?.id]);
    expect(mapped.disclaimerI18n.en).toBe('Patterns are exploratory.');
  });
});
