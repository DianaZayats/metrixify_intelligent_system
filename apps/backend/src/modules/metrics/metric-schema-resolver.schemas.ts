import { z } from 'zod';

export const schemaResolverDecisionSchema = z.object({
  observation_id: z.string().min(1),
  action: z.enum(['link_existing', 'keep_new', 'add_alias']),
  target_metric_id: z.string().nullable(),
  alias_to_add: z.string().max(120).nullable(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(300).nullable(),
});

export const schemaResolverOutputSchema = z.object({
  decisions: z.array(schemaResolverDecisionSchema),
});

export type SchemaResolverDecision = z.infer<typeof schemaResolverDecisionSchema>;
export type SchemaResolverOutput = z.infer<typeof schemaResolverOutputSchema>;

export const schemaResolverContextSchema = z.object({
  schema_version: z.literal('1'),
  entry: z.object({
    id: z.string(),
    entry_date: z.string(),
    summary: z.string().nullable(),
  }),
  observations: z.array(
    z.object({
      id: z.string(),
      metric_definition_id: z.string(),
      metric_key: z.string(),
      metric_title: z.string(),
      value_type: z.string(),
      value_display: z.string(),
      evidence_text: z.string().nullable(),
      confidence: z.number().nullable(),
    }),
  ),
  candidate_metrics: z.array(
    z.object({
      id: z.string(),
      key: z.string(),
      title: z.string(),
      value_type: z.string(),
      aliases: z.array(z.string()),
      tags: z.array(z.string()),
      description: z.string().nullable(),
      similarity_score: z.number().nullable(),
    }),
  ),
});

export type SchemaResolverContextPack = z.infer<typeof schemaResolverContextSchema>;

export const updateMetricDefinitionBodySchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  aliases: z.array(z.string().min(1).max(120)).max(20).optional(),
  tags: z.array(z.string().min(1).max(32)).max(10).optional(),
});

export type UpdateMetricDefinitionBody = z.infer<typeof updateMetricDefinitionBodySchema>;
