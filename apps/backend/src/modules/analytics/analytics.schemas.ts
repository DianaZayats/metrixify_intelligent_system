import { z } from 'zod';
import { CORRELATION_METHODS } from '@metrixify/shared-types';

export const correlationIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const correlationsQuerySchema = z.object({
  method: z.enum(CORRELATION_METHODS).optional(),
  lagDays: z.coerce.number().int().min(-1).max(1).optional(),
  minSample: z.coerce.number().int().min(7).optional(),
});

export const dashboardQuerySchema = z.object({
  chartMetricId: z.string().min(1).optional(),
});

export type CorrelationsQuery = z.infer<typeof correlationsQuerySchema>;
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
