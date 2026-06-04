import type { FastifyInstance } from 'fastify';
import { requireSession } from '../../shared/hooks/session-auth.hook.js';
import { updateUserLocaleBodySchema } from '../../shared/schemas/localized-string.schema.js';
import { toAuthUser } from '../auth/auth.service.js';
import { buildUserExportXlsxBuffer } from './user-export-xlsx.service.js';
import { deleteUserDataForUser, exportUserDataForUser } from './user.service.js';
import { deleteUserDataBodySchema, userExportQuerySchema } from './user.schemas.js';
import { updateUserLocale } from './user.repository.js';

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  app.patch('/api/user/locale', { preHandler: requireSession }, async (request) => {
    const body = updateUserLocaleBodySchema.parse(request.body ?? {});
    const user = await updateUserLocale(request.authUser.id, body.locale);
    return {
      locale: user.locale,
      user: toAuthUser(user, request.telegramUsername),
    };
  });

  app.post('/api/user/delete-data', { preHandler: requireSession }, async (request) => {
    deleteUserDataBodySchema.parse(request.body ?? {});
    return deleteUserDataForUser(request.authUser.id);
  });

  app.get('/api/user/export', { preHandler: requireSession }, async (request, reply) => {
    const { format } = userExportQuerySchema.parse(request.query ?? {});
    const payload = await exportUserDataForUser(request.authUser.id);
    const stamp = payload.exportedAt.slice(0, 10);

    if (format === 'xlsx') {
      const buffer = await buildUserExportXlsxBuffer(payload);
      reply.header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      reply.header('Content-Disposition', `attachment; filename="metrixify-export-${stamp}.xlsx"`);
      return reply.send(buffer);
    }

    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="metrixify-export-${stamp}.json"`);
    return payload;
  });
}
