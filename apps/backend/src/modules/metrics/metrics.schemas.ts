import { z } from 'zod';
import { METRIC_VALUE_TYPES } from '@metrixify/shared-types';

export const metricIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const metricDefinitionListItemSchema = z.object({
  id: z.string(),
  key: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  valueType: z.enum(METRIC_VALUE_TYPES),
  unit: z.string().nullable(),
  scaleMin: z.number().nullable(),
  scaleMax: z.number().nullable(),
  aliases: z.array(z.string()),
  tags: z.array(z.string()),
  status: z.enum(['active', 'archived']),
  observationCount: z.number(),
  lastObservedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const metricObservationItemSchema = z.object({
  id: z.string(),
  entryId: z.string(),
  metricDefinitionId: z.string(),
  metricKey: z.string(),
  metricTitle: z.string(),
  valueType: z.enum(METRIC_VALUE_TYPES),
  unit: z.string().nullable(),
  scaleMin: z.number().nullable(),
  scaleMax: z.number().nullable(),
  valueNumber: z.number().nullable(),
  valueText: z.string().nullable(),
  valueBoolean: z.boolean().nullable(),
  valueDisplay: z.string(),
  confidence: z.number().nullable(),
  evidenceText: z.string().nullable(),
  observedAt: z.string(),
  observedAtPrecision: z.enum(['exact', 'inferred', 'date_only']).nullable(),
  narrativeOrder: z.number().nullable(),
  createdAt: z.string(),
});

export const metricObservationsResponseSchema = z.object({
  items: z.array(metricObservationItemSchema),
});

export const observationIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const updateObservationBodySchema = z
  .object({
    valueNumber: z.number().nullable().optional(),
    valueText: z.string().nullable().optional(),
    valueBoolean: z.boolean().nullable().optional(),
    observedAt: z.string().datetime().optional(),
    evidenceText: z.string().min(1).max(500).nullable().optional(),
    observedAtPrecision: z.enum(['exact', 'inferred', 'date_only']).nullable().optional(),
    narrativeOrder: z.number().int().min(1).max(99).nullable().optional(),
    editedVia: z.enum(['api', 'telegram', 'system']).optional(),
  })
  .refine(
    (body) =>
      body.valueNumber !== undefined ||
      body.valueText !== undefined ||
      body.valueBoolean !== undefined ||
      body.observedAt !== undefined ||
      body.evidenceText !== undefined ||
      body.observedAtPrecision !== undefined ||
      body.narrativeOrder !== undefined,
    { message: 'At least one field must be provided' },
  );

export const deleteObservationBodySchema = z.object({
  editedVia: z.enum(['api', 'telegram', 'system']).optional(),
});

export const archiveMetricBodySchema = z.object({
  editedVia: z.enum(['api', 'telegram', 'system']).optional(),
  entryId: z.string().min(1).optional(),
});

export type UpdateObservationBody = z.infer<typeof updateObservationBodySchema>;
export type DeleteObservationBody = z.infer<typeof deleteObservationBodySchema>;
export type ArchiveMetricBody = z.infer<typeof archiveMetricBodySchema>;

export const metricsListResponseSchema = z.object({
  items: z.array(metricDefinitionListItemSchema),
});
