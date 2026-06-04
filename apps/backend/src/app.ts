import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { registerSystemRoutes } from './modules/system/system.routes.js';
import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import { registerEntriesRoutes } from './modules/entries/entries.routes.js';
import { registerMetricsRoutes } from './modules/metrics/metrics.routes.js';
import { registerProfileFactsRoutes } from './modules/profile-facts/profile-facts.routes.js';
import { registerUserRoutes } from './modules/users/user.routes.js';
import { registerAnalyticsRoutes } from './modules/analytics/analytics.routes.js';
import { registerInsightsRoutes } from './modules/insights/insights.routes.js';
import { registerTelegramInternalRoutes } from './modules/telegram/telegram-internal.routes.js';
import { registerErrorHandler } from './shared/hooks/error-handler.js';
import { getSessionSecret } from '@metrixify/config';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  registerErrorHandler(app);

  // Allow POST with Content-Type: application/json and an empty body (e.g. logout from fetch).
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (body === '' || body === undefined) {
      done(null, {});
      return;
    }
    try {
      done(null, JSON.parse(body as string) as unknown);
    } catch (error) {
      done(error as Error, undefined);
    }
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(cookie, {
    secret: getSessionSecret(),
    hook: 'onRequest',
  });

  await registerSystemRoutes(app);
  await registerAuthRoutes(app);
  await registerEntriesRoutes(app);
  await registerMetricsRoutes(app);
  await registerProfileFactsRoutes(app);
  await registerUserRoutes(app);
  await registerAnalyticsRoutes(app);
  await registerInsightsRoutes(app);
  await registerTelegramInternalRoutes(app);

  return app;
}
