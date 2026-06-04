import type { FastifyInstance } from 'fastify';
import { verifyInternalApiKey } from '../../shared/hooks/internal-auth.hook.js';
import { createTelegramLoginLink } from '../auth/auth.service.js';
import { telegramLoginLinkSchema } from '../auth/auth.schemas.js';
import {
  getRecentEntriesForTelegramUser,
  ingestTelegramTextMessage,
  ingestTelegramVoiceMessage,
  saveTelegramEntrySummaryMessage,
} from '../entries/entry.service.js';
import { entryIdParamsSchema } from '../entries/entries.schemas.js';
import {
  appendTelegramConversationTurnForUser,
  routeTelegramTextMessage,
} from './telegram-message-router.service.js';
import { toListItem } from '../entries/entry.mapper.js';
import {
  statusEntriesQuerySchema,
  telegramMessageIngestSchema,
  telegramVoiceIngestSchema,
} from '../entries/entries.schemas.js';
import {
  getTelegramUserLocale,
  updateTelegramUserLocale,
} from './telegram-locale.service.js';
import {
  getTelegramCorrelationsSnapshot,
  getTelegramInsightsSnapshot,
} from './telegram-read.service.js';
import {
  telegramSnapshotQuerySchema,
  telegramSummaryMessageSchema,
  telegramConversationTurnSchema,
  telegramMessageRouteSchema,
  telegramUserLocalePatchSchema,
  telegramUserLocaleQuerySchema,
} from './telegram.schemas.js';

export async function registerTelegramInternalRoutes(app: FastifyInstance): Promise<void> {
  await app.register(
    async (internal) => {
      internal.addHook('preHandler', verifyInternalApiKey);

      internal.post('/telegram/message', async (request) => {
        const body = telegramMessageIngestSchema.parse(request.body);
        return ingestTelegramTextMessage(body);
      });

      internal.post('/telegram/message/route', async (request) => {
        const body = telegramMessageRouteSchema.parse(request.body);
        return routeTelegramTextMessage(body);
      });

      internal.post('/telegram/conversation/turn', async (request) => {
        const body = telegramConversationTurnSchema.parse(request.body);
        await appendTelegramConversationTurnForUser({
          telegramUserId: body.telegramUserId,
          chatId: BigInt(body.chatId),
          role: body.role,
          turnType: body.turnType,
          text: body.text,
          telegramMessageId:
            body.telegramMessageId != null ? BigInt(body.telegramMessageId) : null,
          replyToMessageId:
            body.replyToMessageId != null ? BigInt(body.replyToMessageId) : null,
          entryId: body.entryId ?? null,
        });
        return { ok: true };
      });

      internal.post('/telegram/voice', async (request) => {
        const body = telegramVoiceIngestSchema.parse(request.body);
        return ingestTelegramVoiceMessage(body);
      });

      internal.get('/telegram/status', async (request) => {
        const { telegramUserId } = statusEntriesQuerySchema.parse(request.query);
        const entries = await getRecentEntriesForTelegramUser(telegramUserId, 5);
        return { items: entries.map(toListItem) };
      });

      internal.get('/telegram/correlations', async (request) => {
        const { telegramUserId, limit } = telegramSnapshotQuerySchema.parse(request.query);
        return getTelegramCorrelationsSnapshot(telegramUserId, limit ?? 5);
      });

      internal.get('/telegram/insights', async (request) => {
        const { telegramUserId } = telegramSnapshotQuerySchema.parse(request.query);
        return getTelegramInsightsSnapshot(telegramUserId);
      });

      internal.post('/telegram/login-link', async (request) => {
        const body = telegramLoginLinkSchema.parse(request.body);
        const { loginUrl, expiresAt } = await createTelegramLoginLink({
          telegramUserId: BigInt(body.telegramUserId),
          username: body.username,
          firstName: body.firstName,
          lastName: body.lastName,
          languageCode: body.languageCode,
        });
        return { loginUrl, expiresAt: expiresAt.toISOString() };
      });

      internal.get('/telegram/user-locale', async (request) => {
        const { telegramUserId } = telegramUserLocaleQuerySchema.parse(request.query);
        const locale = await getTelegramUserLocale(BigInt(telegramUserId));
        return { locale };
      });

      internal.patch('/telegram/user-locale', async (request) => {
        const body = telegramUserLocalePatchSchema.parse(request.body);
        const locale = await updateTelegramUserLocale(BigInt(body.telegramUserId), body.locale, {
          username: body.username,
          firstName: body.firstName,
          lastName: body.lastName,
          languageCode: body.languageCode,
        });
        return { locale };
      });

      internal.patch('/telegram/entries/:id/summary-message', async (request) => {
        const { id } = entryIdParamsSchema.parse(request.params);
        const body = telegramSummaryMessageSchema.parse(request.body);
        await saveTelegramEntrySummaryMessage({
          entryId: id,
          telegramUserId: body.telegramUserId,
          chatId: body.chatId,
          inboundMessageId: body.inboundMessageId,
          summaryMessageId: body.summaryMessageId,
        });
        return { ok: true };
      });
    },
    { prefix: '/api/internal' },
  );
}
