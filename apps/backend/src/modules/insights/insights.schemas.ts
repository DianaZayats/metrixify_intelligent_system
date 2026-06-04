import { z } from 'zod';
import { APP_LOCALES, INSIGHT_CONFIDENCE_LEVELS, PROFILE_FACT_TYPES } from '@metrixify/shared-types';

const insightTitleI18nSchema = z.object({
  en: z.string().min(1).max(120),
  uk: z.string().min(1).max(120),
});

const insightBodyI18nSchema = z.object({
  en: z.string().min(1).max(1200),
  uk: z.string().min(1).max(1200),
});

const recommendationBodyI18nSchema = z.object({
  en: z.string().min(1).max(800),
  uk: z.string().min(1).max(800),
});

export const insightsGenerationContextSchema = z.object({
  schema_version: z.literal('1'),
  user: z.object({
    locale: z.enum(APP_LOCALES),
    timezone: z.string(),
  }),
  profile_facts: z.array(
    z.object({
      key: z.string(),
      value_text: z.string(),
      fact_type: z.enum(PROFILE_FACT_TYPES),
      stability: z.enum(['stable', 'evolving']),
    }),
  ),
  correlations: z.array(
    z.object({
      ref_index: z.number().int().min(0),
      correlation_id: z.string(),
      metric_a_key: z.string(),
      metric_a_title: z.string(),
      metric_b_key: z.string(),
      metric_b_title: z.string(),
      method: z.enum(['pearson', 'spearman']),
      lag_days: z.number().int(),
      sample_size: z.number().int(),
      correlation_value: z.number(),
      strength_label: z.enum(['weak', 'moderate', 'strong']),
      exploratory: z.boolean(),
    }),
  ),
});

export type InsightsGenerationContextPack = z.infer<typeof insightsGenerationContextSchema>;

export const insightCandidateAiSchema = z.object({
  title_i18n: insightTitleI18nSchema,
  body_i18n: insightBodyI18nSchema,
  confidence: z.enum(INSIGHT_CONFIDENCE_LEVELS),
  correlation_ref_indices: z.array(z.number().int().min(0)).max(3),
});

export const recommendationCandidateAiSchema = z.object({
  title_i18n: insightTitleI18nSchema,
  body_i18n: recommendationBodyI18nSchema,
  related_insight_indices: z.array(z.number().int().min(0)).max(3),
});

export const disclaimerI18nAiSchema = z.object({
  en: z.string().min(1).max(400),
  uk: z.string().min(1).max(400),
});

export const insightsGenerationAiOutputSchema = z.object({
  insights: z.array(insightCandidateAiSchema).max(8),
  recommendations: z.array(recommendationCandidateAiSchema).max(6),
  disclaimer_i18n: disclaimerI18nAiSchema,
});

export type InsightsGenerationAiOutput = z.infer<typeof insightsGenerationAiOutputSchema>;

export const insightReportIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const insightsListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const DASHBOARD_INSIGHT_REPORTS_LIMIT = 5;
