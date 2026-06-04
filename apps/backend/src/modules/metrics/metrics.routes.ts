import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireSession } from '../../shared/hooks/session-auth.hook.js';
import { resolveRequestLocale } from '../../shared/locale/resolve-request-locale.js';
import { toMetricListItem, toObservationItem } from './metric.mapper.js';
import {
  archiveMetricForUser,
  deleteObservationForUser,
  getMetricByIdForUser,
  getMetricsForUser,
  getObservationsForUser,
  patchObservationForUser,
  updateMetricForUser,
} from './metrics.service.js';
import {
  metricIdParamsSchema,
  observationIdParamsSchema,
  deleteObservationBodySchema,
  updateObservationBodySchema,
} from './metrics.schemas.js';
import { updateMetricDefinitionBodySchema } from './metric-schema-resolver.schemas.js';

const metricObservationsQuerySchema = z.object({
  metricId: z.string().min(1).optional(),
});

export async function registerMetricsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/metrics', { preHandler: requireSession }, async (request) => {
    const locale = resolveRequestLocale(request, request.authUser.locale);
    const items = await getMetricsForUser(request.authUser.id);
    return { items: items.map((item) => toMetricListItem(item, locale)) };
  });

  app.get('/api/metrics/observations', { preHandler: requireSession }, async (request) => {
    const locale = resolveRequestLocale(request, request.authUser.locale);
    const query = metricObservationsQuerySchema.parse(request.query ?? {});
    const observations = await getObservationsForUser(request.authUser.id, {
      metricId: query.metricId,
    });
    return { items: observations.map((item) => toObservationItem(item, locale)) };
  });

  app.get('/api/metrics/:id', { preHandler: requireSession }, async (request) => {
    const locale = resolveRequestLocale(request, request.authUser.locale);
    const { id } = metricIdParamsSchema.parse(request.params);
    const definition = await getMetricByIdForUser(id, request.authUser.id);
    const items = await getMetricsForUser(request.authUser.id);
    const withStats = items.find((item) => item.id === definition.id);
    if (!withStats) {
      return toMetricListItem(
        {
          ...definition,
          observationCount: 0,
          lastObservedAt: null,
        },
        locale,
      );
    }
    return toMetricListItem(withStats, locale);
  });

  app.patch('/api/metrics/:id', { preHandler: requireSession }, async (request) => {
    const locale = resolveRequestLocale(request, request.authUser.locale);
    const { id } = metricIdParamsSchema.parse(request.params);
    const body = updateMetricDefinitionBodySchema.parse(request.body ?? {});
    const updated = await updateMetricForUser(id, request.authUser.id, body);
    const items = await getMetricsForUser(request.authUser.id);
    const withStats = items.find((item) => item.id === updated.id);
    if (!withStats) {
      return toMetricListItem(
        {
          ...updated,
          observationCount: 0,
          lastObservedAt: null,
        },
        locale,
      );
    }
    return toMetricListItem(withStats, locale);
  });

  app.post('/api/metrics/:id/archive', { preHandler: requireSession }, async (request) => {
    const locale = resolveRequestLocale(request, request.authUser.locale);
    const { id } = metricIdParamsSchema.parse(request.params);
    const archived = await archiveMetricForUser(id, request.authUser.id);
    const items = await getMetricsForUser(request.authUser.id);
    const withStats = items.find((item) => item.id === archived.id);
    if (!withStats) {
      return toMetricListItem(
        {
          ...archived,
          observationCount: 0,
          lastObservedAt: null,
        },
        locale,
      );
    }
    return toMetricListItem(withStats, locale);
  });

  app.patch('/api/observations/:id', { preHandler: requireSession }, async (request) => {
    const locale = resolveRequestLocale(request, request.authUser.locale);
    const { id } = observationIdParamsSchema.parse(request.params);
    const body = updateObservationBodySchema.parse(request.body ?? {});
    const updated = await patchObservationForUser(id, request.authUser.id, body);
    return toObservationItem(updated, locale);
  });

  app.delete('/api/observations/:id', { preHandler: requireSession }, async (request) => {
    const { id } = observationIdParamsSchema.parse(request.params);
    const body = deleteObservationBodySchema.parse(request.body ?? {});
    const audit = await deleteObservationForUser(id, request.authUser.id, body);
    return { deleted: true, audit };
  });
}
