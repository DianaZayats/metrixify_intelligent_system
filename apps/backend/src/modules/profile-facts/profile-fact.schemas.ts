import { z } from 'zod';
import { PROFILE_FACT_TYPES } from '@metrixify/shared-types';
import { localizedStringSchema, openAiLocalizedStringSchema } from '../../shared/schemas/localized-string.schema.js';

export const PROFILE_FACT_STABILITIES = ['stable', 'evolving', 'temporary'] as const;

export const PROFILE_FACT_OPERATIONS = [
  'create_fact',
  'update_fact',
  'add_fact_evidence',
  'skip',
] as const;

const profileFactCandidateCoreSchema = z.object({
  key: z.string().min(1).max(64),
  value_text: z.string().min(1).max(500),
  fact_type: z.enum(PROFILE_FACT_TYPES),
  stability: z.enum(PROFILE_FACT_STABILITIES),
  evidence_text: z.string().min(1).max(500),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(300).nullable(),
  operation: z.enum(PROFILE_FACT_OPERATIONS),
});

export const profileFactCandidateAiSchema = profileFactCandidateCoreSchema.extend({
  value_i18n: openAiLocalizedStringSchema,
});

export const profileFactExtractionAiOutputSchema = z.object({
  facts: z.array(profileFactCandidateAiSchema).max(10),
});

export const profileFactCandidateSchema = profileFactCandidateCoreSchema.extend({
  value_i18n: localizedStringSchema.optional(),
});

export type ProfileFactCandidate = z.infer<typeof profileFactCandidateSchema>;

export const profileFactExtractionOutputSchema = z.object({
  facts: z.array(profileFactCandidateSchema).max(10),
});

export type ProfileFactExtractionOutput = z.infer<typeof profileFactExtractionOutputSchema>;

export const profileFactExtractionContextSchema = z.object({
  schema_version: z.literal('1'),
  entry: z.object({
    id: z.string(),
    entry_date: z.string(),
    recorded_at: z.string().datetime(),
    source_type: z.enum(['text', 'voice', 'manual']),
    text: z.string(),
    summary: z.string().nullable(),
  }),
  user: z.object({
    timezone: z.string(),
  }),
  existing_profile_facts: z.array(
    z.object({
      key: z.string(),
      value_text: z.string(),
      fact_type: z.enum(PROFILE_FACT_TYPES),
      stability: z.enum(['stable', 'evolving']),
    }),
  ),
});

export type ProfileFactExtractionContextPack = z.infer<typeof profileFactExtractionContextSchema>;

export const profileFactIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const profileFactsListQuerySchema = z.object({
  status: z.enum(['active', 'archived', 'outdated']).optional(),
});

export const updateProfileFactBodySchema = z.object({
  valueText: z.string().min(1).max(500).optional(),
  factType: z.enum(PROFILE_FACT_TYPES).optional(),
});

export type UpdateProfileFactBody = z.infer<typeof updateProfileFactBodySchema>;
