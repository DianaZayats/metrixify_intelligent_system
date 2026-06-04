import { z } from 'zod';
import { METRIC_EXTRACTION_VALUE_TYPES, PROFILE_FACT_TYPES } from '@metrixify/shared-types';
import { localizedStringSchema, openAiLocalizedStringSchema } from '../../shared/schemas/localized-string.schema.js';

export const OBSERVED_AT_PRECISIONS = ['exact', 'inferred', 'date_only'] as const;

const sanitizeNullableDatetime = z.preprocess(
  (value) => {
    if (value == null) {
      return null;
    }
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const check = z.string().datetime().safeParse(trimmed);
    return check.success ? trimmed : null;
  },
  z.string().datetime().nullable(),
);

export const metricTagEntryAiSchema = z.object({
  slug: z.string().min(1).max(32),
  label_i18n: openAiLocalizedStringSchema,
});

const metricCandidateCoreSchema = z.object({
  candidate_key: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  value_type: z.enum(METRIC_EXTRACTION_VALUE_TYPES),
  value_number: z.number().nullable(),
  value_text: z.string().nullable(),
  value_boolean: z.boolean().nullable(),
  unit: z.string().max(32).nullable(),
  scale_min: z.number().nullable(),
  scale_max: z.number().nullable(),
  evidence_text: z.string().min(1).max(500),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(300).nullable(),
  observed_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  observed_at: z.string().datetime().nullable(),
  observed_at_precision: z.enum(OBSERVED_AT_PRECISIONS).nullable(),
  narrative_order: z.number().int().min(1).max(99).nullable(),
  tags: z.array(z.string().min(1).max(32)).max(10),
});

/** Strict schema passed to OpenAI structured output (no optional fields, no z.record). */
export const metricCandidateAiSchema = metricCandidateCoreSchema
  .omit({ observed_at: true })
  .extend({
    observed_at: sanitizeNullableDatetime,
    title_i18n: openAiLocalizedStringSchema,
    tag_entries: z.array(metricTagEntryAiSchema).max(10),
  });

export const metricExtractionAiOutputSchema = z.object({
  metrics: z.array(metricCandidateAiSchema).max(15),
});

export const metricTagEntrySchema = z.object({
  slug: z.string().min(1).max(32),
  label_i18n: localizedStringSchema,
});

/** Relaxed schema for fixtures, stored runs, and downstream normalization. */
export const metricCandidateSchema = metricCandidateCoreSchema.extend({
  title_i18n: localizedStringSchema.optional(),
  tag_entries: z.array(metricTagEntrySchema).max(10).optional(),
  tags_i18n: z.record(localizedStringSchema).optional(),
});

export type MetricCandidate = z.infer<typeof metricCandidateSchema>;

export const metricExtractionOutputSchema = z.object({
  metrics: z.array(metricCandidateSchema).max(15),
});

export type MetricExtractionOutput = z.infer<typeof metricExtractionOutputSchema>;

export const metricExtractionContextSchema = z.object({
  schema_version: z.literal('1'),
  entry: z.object({
    id: z.string(),
    entry_date: z.string(),
    recorded_at: z.string().datetime(),
    source_type: z.enum(['text', 'voice', 'manual']),
    text: z.string(),
  }),
  user: z.object({
    timezone: z.string(),
  }),
  existing_metrics: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      value_type: z.enum(METRIC_EXTRACTION_VALUE_TYPES),
      aliases: z.array(z.string()),
      tags: z.array(z.string()),
    }),
  ),
  existing_profile_facts: z.array(
    z.object({
      key: z.string(),
      value_text: z.string(),
      fact_type: z.enum(PROFILE_FACT_TYPES),
    }),
  ),
});

export type MetricExtractionContextPack = z.infer<typeof metricExtractionContextSchema>;
