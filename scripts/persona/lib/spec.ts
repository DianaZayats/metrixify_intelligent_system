import { z } from 'zod';

export const personaMetricSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  value_type: z.enum(['number', 'ordinal', 'boolean']),
  title_i18n: z
    .object({
      en: z.string().optional(),
      uk: z.string().optional(),
    })
    .optional(),
});

export const latentPatternSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('boolean_cooccurrence'),
    metric_a: z.string().min(1),
    metric_b: z.string().min(1),
    lag_days: z.number().int(),
    target_min_r: z.number().optional(),
    base_rate_a: z.number().min(0).max(1).default(0.5),
    cooccurrence_rate: z.number().min(0).max(1).default(0.85),
    base_rate_b: z.number().min(0).max(1).default(0.1),
  }),
]);

export const personaSpecSchema = z.object({
  id: z.string().min(1),
  locale: z.enum(['en', 'uk']).default('en'),
  timezone: z.string().default('UTC'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  calendar_days: z.number().int().min(14).max(120),
  event_density: z.number().min(0.1).max(1),
  diary_format: z.enum(['daily', 'weekly_recap']).default('daily'),
  recap_count: z.number().int().min(1).max(12).default(5),
  /** Use another persona id's PRNG seed so manifest day signals match (e.g. quick vs full). */
  generation_seed_from: z.string().min(1).optional(),
  metrics: z.array(personaMetricSchema).min(1),
  latent_patterns: z.array(latentPatternSchema).min(1),
  narrative_rules: z
    .object({
      never_state_diagnosis: z.boolean().optional(),
      describe_episodes_indirectly: z.boolean().optional(),
    })
    .optional(),
});

export const expectedCorrelationSchema = z.object({
  metric_a: z.string().min(1),
  metric_b: z.string().min(1),
  method: z.enum(['pearson', 'spearman']).default('pearson'),
  lag_days: z.number().int(),
  min_r: z.number().min(0).max(1),
  min_sample: z.number().int().min(14).default(14),
});

export const expectedCorrelationsSchema = z.object({
  required: z.array(expectedCorrelationSchema).default([]),
  optional: z.array(expectedCorrelationSchema).default([]),
  extra_threshold: z.number().min(0).max(1).default(0.3),
});

export type PersonaSpec = z.infer<typeof personaSpecSchema>;
export type PersonaMetric = z.infer<typeof personaMetricSchema>;
export type ExpectedCorrelations = z.infer<typeof expectedCorrelationsSchema>;
export type ExpectedCorrelation = z.infer<typeof expectedCorrelationSchema>;
