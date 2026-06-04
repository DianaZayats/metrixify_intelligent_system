import { z } from 'zod';
import { METRIC_EXTRACTION_VALUE_TYPES } from '@metrixify/shared-types';

export const telegramMetricCorrectionAiOutputSchema = z
  .object({
    command: z.enum([
      'fix_value',
      'fix_observed_at',
      'add_observation',
      'remove_observation',
      'archive_metric',
      'reprocess_entry',
      'unsupported',
    ]),
    apply_to: z.enum(['single', 'all_on_entry']),
    observation_id: z.string().nullable(),
    observed_at: z.string().nullable(),
    observed_date: z.string().nullable(),
    observed_at_precision: z.enum(['exact', 'inferred', 'date_only']).nullable(),
    metric_key: z.string().nullable(),
    title: z.string().nullable(),
    value_type: z.enum(METRIC_EXTRACTION_VALUE_TYPES).nullable(),
    unit: z.string().nullable(),
    scale_min: z.number().nullable(),
    scale_max: z.number().nullable(),
    evidence_text: z.string().nullable(),
    value_boolean: z.boolean().nullable(),
    value_number: z.number().nullable(),
    reasoning: z.string().min(1).max(500),
  })
  .superRefine((data, ctx) => {
    if (data.command === 'unsupported') {
      return;
    }
    if (data.command === 'fix_value') {
      if (!data.observation_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'fix_value requires observation_id',
          path: ['observation_id'],
        });
      }
      if (data.value_boolean === null && data.value_number === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'fix_value requires value_boolean or value_number',
          path: ['value_boolean'],
        });
      }
      return;
    }
    if (data.command === 'fix_observed_at') {
      if (data.observed_at === null && data.observed_date === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'fix_observed_at requires observed_at or observed_date',
          path: ['observed_at'],
        });
      }
      if (data.apply_to === 'single' && !data.observation_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'fix_observed_at single requires observation_id',
          path: ['observation_id'],
        });
      }
      return;
    }
    if (data.command === 'add_observation') {
      if (!data.metric_key?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'add_observation requires metric_key',
          path: ['metric_key'],
        });
      }
      if (!data.title?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'add_observation requires title',
          path: ['title'],
        });
      }
      if (!data.value_type) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'add_observation requires value_type',
          path: ['value_type'],
        });
      }
      if (!data.evidence_text?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'add_observation requires evidence_text',
          path: ['evidence_text'],
        });
      }
      if (data.observed_at === null && data.observed_date === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'add_observation requires observed_at or observed_date',
          path: ['observed_at'],
        });
      }
      if (data.value_type === 'boolean' && data.value_boolean === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'boolean add_observation requires value_boolean',
          path: ['value_boolean'],
        });
      }
      if (
        (data.value_type === 'number' || data.value_type === 'ordinal') &&
        data.value_number === null
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'numeric add_observation requires value_number',
          path: ['value_number'],
        });
      }
      return;
    }
    if (data.command === 'remove_observation') {
      if (!data.observation_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'remove_observation requires observation_id',
          path: ['observation_id'],
        });
      }
      return;
    }
    if (data.command === 'archive_metric') {
      if (!data.metric_key?.trim() && !data.observation_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'archive_metric requires metric_key or observation_id',
          path: ['metric_key'],
        });
      }
      return;
    }
    if (data.command === 'reprocess_entry') {
      return;
    }
  });

export type TelegramMetricCorrectionAiOutput = z.infer<
  typeof telegramMetricCorrectionAiOutputSchema
>;

export const telegramMetricCorrectionContextPackSchema = z.object({
  schema_version: z.literal('1'),
  user_message: z.object({
    text: z.string(),
    reply_to_message_id: z.number().nullable(),
  }),
  entry: z.object({
    id: z.string(),
    entry_date: z.string(),
    text_preview: z.string().nullable(),
  }),
  recent_conversation: z.array(
    z.object({
      role: z.string(),
      turn_type: z.string(),
      text: z.string(),
      entry_id: z.string().nullable(),
    }),
  ),
  last_corrected_metric_title: z.string().nullable(),
  existing_metrics: z.array(
    z.object({
      key: z.string(),
      title: z.string(),
      value_type: z.enum(['number', 'ordinal', 'boolean', 'category']),
      aliases: z.array(z.string()),
    }),
  ),
  observations: z.array(
    z.object({
      id: z.string(),
      metric_key: z.string(),
      title: z.string(),
      value_type: z.enum(['number', 'ordinal', 'boolean', 'category']),
      unit: z.string().nullable(),
      scale_min: z.number().nullable(),
      scale_max: z.number().nullable(),
      value_boolean: z.boolean().nullable(),
      value_number: z.number().nullable(),
      value_display: z.string(),
      observed_at: z.string(),
    }),
  ),
});

export type TelegramMetricCorrectionContextPack = z.infer<
  typeof telegramMetricCorrectionContextPackSchema
>;
