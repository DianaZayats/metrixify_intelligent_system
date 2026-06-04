import type { FastifyInstance } from 'fastify';
import { requireSession } from '../../shared/hooks/session-auth.hook.js';
import { insightReportIdParamsSchema, insightsListQuerySchema } from './insights.schemas.js';
import {
  generateInsightsForSessionUser,
  getInsightReportForUser,
  getLatestInsightsForUser,
  listInsightsForUser,
  resolveInsightsViewLocale,
} from './insights.service.js';

export async function registerInsightsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/insights/latest', { preHandler: requireSession }, async (request) => {
    const locale = resolveInsightsViewLocale(request, request.authUser.locale);
    return getLatestInsightsForUser(request.authUser.id, locale);
  });

  app.get('/api/insights', { preHandler: requireSession }, async (request) => {
    const locale = resolveInsightsViewLocale(request, request.authUser.locale);
    const query = insightsListQuerySchema.parse(request.query ?? {});
    return listInsightsForUser(request.authUser.id, query.limit, locale);
  });

  app.get('/api/insights/:id', { preHandler: requireSession }, async (request) => {
    const locale = resolveInsightsViewLocale(request, request.authUser.locale);
    const { id } = insightReportIdParamsSchema.parse(request.params);
    return getInsightReportForUser(request.authUser.id, id, locale);
  });

  app.post('/api/insights/generate', { preHandler: requireSession }, async (request) => {
    return generateInsightsForSessionUser({
      request,
      userId: request.authUser.id,
      userLocale: request.authUser.locale,
      timezone: request.authUser.timezone,
    });
  });
}
