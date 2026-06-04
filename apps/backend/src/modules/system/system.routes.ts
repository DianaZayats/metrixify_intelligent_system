import type { FastifyInstance } from 'fastify';
import { getConfig } from '@metrixify/config';
import type { HealthResponse, VersionResponse } from '@metrixify/shared-types';
import { checkDatabaseConnection } from '../../shared/db/prisma.js';
import { checkRedisConnection } from '../../shared/redis/client.js';

export async function registerSystemRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/system/health', async (): Promise<HealthResponse> => {
    const [databaseOk, redisOk] = await Promise.all([
      checkDatabaseConnection(),
      checkRedisConnection(),
    ]);

    const status = databaseOk ? 'ok' : 'degraded';

    return {
      status,
      checks: {
        database: databaseOk ? 'ok' : 'error',
        redis: redisOk ? 'ok' : 'error',
      },
    };
  });

  app.get('/api/system/version', async (): Promise<VersionResponse> => {
    const config = getConfig();
    return {
      name: 'metrixify',
      version: config.APP_VERSION,
      environment: config.NODE_ENV,
    };
  });
}
