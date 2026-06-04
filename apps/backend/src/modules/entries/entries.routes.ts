import type { FastifyInstance } from 'fastify';
import { requireSession } from '../../shared/hooks/session-auth.hook.js';
import { resolveRequestLocale } from '../../shared/locale/resolve-request-locale.js';
import { getEntriesForUser, getEntryByIdForUser, reprocessEntryMetricsForUser } from './entry.service.js';
import { toDetailWithObservations, toListItem } from './entry.mapper.js';
import { entriesQuerySchema, entryIdParamsSchema } from './entries.schemas.js';
import { findUserById } from '../users/user.repository.js';

export async function registerEntriesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/entries', { preHandler: requireSession }, async (request) => {
    const query = entriesQuerySchema.parse(request.query);
    const { items, total } = await getEntriesForUser(
      request.authUser.id,
      query.limit,
      query.offset,
    );
    return {
      items: items.map(toListItem),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  });

  app.get('/api/entries/:id', { preHandler: requireSession }, async (request) => {
    const { id } = entryIdParamsSchema.parse(request.params);
    const locale = resolveRequestLocale(request, request.authUser.locale);
    const entry = await getEntryByIdForUser(id, request.authUser.id);
    return toDetailWithObservations(entry, request.authUser.id, locale);
  });

  app.post('/api/entries/:id/reprocess', { preHandler: requireSession }, async (request) => {
    const { id } = entryIdParamsSchema.parse(request.params);
    const locale = resolveRequestLocale(request, request.authUser.locale);
    const user = await findUserById(request.authUser.id);
    const entry = await reprocessEntryMetricsForUser(
      id,
      request.authUser.id,
      user?.timezone ?? 'UTC',
    );
    return toDetailWithObservations(entry, request.authUser.id, locale);
  });
}
