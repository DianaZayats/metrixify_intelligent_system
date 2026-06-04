import type { FastifyInstance } from 'fastify';
import { requireSession } from '../../shared/hooks/session-auth.hook.js';
import {
  resolveContentGenerationLocale,
  resolveRequestLocale,
} from '../../shared/locale/resolve-request-locale.js';
import {
  correlationIdParamsSchema,
  correlationsQuerySchema,
  dashboardQuerySchema,
} from './analytics.schemas.js';
import {
  getAnalyticsCorrelationById,
  getAnalyticsCorrelations,
  getAnalyticsDashboard,
  recalculateAnalyticsForUser,
} from './analytics.service.js';

export async function registerAnalyticsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/analytics/dashboard', { preHandler: requireSession }, async (request) => {
    const locale = resolveContentGenerationLocale(request, request.authUser.locale);
    const query = dashboardQuerySchema.parse(request.query ?? {});
    return getAnalyticsDashboard(request.authUser.id, query, locale);
  });

  app.get('/api/analytics/correlations', { preHandler: requireSession }, async (request) => {
    const locale = resolveRequestLocale(request, request.authUser.locale);
    const query = correlationsQuerySchema.parse(request.query ?? {});
    return getAnalyticsCorrelations(request.authUser.id, query, locale);
  });

  app.get('/api/analytics/correlations/:id', { preHandler: requireSession }, async (request) => {
    const locale = resolveRequestLocale(request, request.authUser.locale);
    const { id } = correlationIdParamsSchema.parse(request.params);
    return getAnalyticsCorrelationById(request.authUser.id, id, locale);
  });

  app.post('/api/analytics/recalculate', { preHandler: requireSession }, async (request) => {
    return recalculateAnalyticsForUser(request.authUser.id);
  });
}
