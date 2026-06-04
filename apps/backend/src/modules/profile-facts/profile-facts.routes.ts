import type { FastifyInstance } from 'fastify';
import { requireSession } from '../../shared/hooks/session-auth.hook.js';
import { resolveRequestLocale } from '../../shared/locale/resolve-request-locale.js';
import { toProfileFactListItem } from './profile-fact.mapper.js';
import {
  archiveProfileFactItemForUser,
  getProfileFactsForUser,
  updateProfileFactItemForUser,
} from './profile-facts.service.js';
import {
  profileFactIdParamsSchema,
  profileFactsListQuerySchema,
  updateProfileFactBodySchema,
} from './profile-fact.schemas.js';

export async function registerProfileFactsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/profile-facts', { preHandler: requireSession }, async (request) => {
    const locale = resolveRequestLocale(request, request.authUser.locale);
    const query = profileFactsListQuerySchema.parse(request.query ?? {});
    const items = await getProfileFactsForUser(request.authUser.id, {
      status: query.status,
    });
    return { items: items.map((item) => toProfileFactListItem(item, locale)) };
  });

  app.patch('/api/profile-facts/:id', { preHandler: requireSession }, async (request) => {
    const locale = resolveRequestLocale(request, request.authUser.locale);
    const { id } = profileFactIdParamsSchema.parse(request.params);
    const body = updateProfileFactBodySchema.parse(request.body ?? {});
    const updated = await updateProfileFactItemForUser(id, request.authUser.id, body);
    return toProfileFactListItem(updated, locale);
  });

  app.post('/api/profile-facts/:id/archive', { preHandler: requireSession }, async (request) => {
    const locale = resolveRequestLocale(request, request.authUser.locale);
    const { id } = profileFactIdParamsSchema.parse(request.params);
    const archived = await archiveProfileFactItemForUser(id, request.authUser.id);
    return toProfileFactListItem(archived, locale);
  });
}
