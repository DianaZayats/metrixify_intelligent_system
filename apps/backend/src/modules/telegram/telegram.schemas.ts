import { z } from 'zod';
import { APP_LOCALES } from '@metrixify/shared-types';

export const telegramUserLocaleQuerySchema = z.object({
  telegramUserId: z.coerce.number().int().positive(),
});

export const telegramUserLocalePatchSchema = z.object({
  telegramUserId: z.coerce.number().int().positive(),
  locale: z.enum(APP_LOCALES),
  username: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  languageCode: z.string().optional().nullable(),
});

export const telegramSnapshotQuerySchema = z.object({
  telegramUserId: z.coerce.number().int().positive(),
  limit: z.coerce.number().int().min(1).max(10).optional(),
});

export const telegramSummaryMessageSchema = z.object({
  telegramUserId: z.coerce.number().int().positive(),
  chatId: z.coerce.number().int(),
  inboundMessageId: z.coerce.number().int().positive(),
  summaryMessageId: z.coerce.number().int().positive(),
});

export const telegramMessageRouteSchema = z.object({
  updateId: z.number().int().positive(),
  messageId: z.number().int().positive(),
  chatId: z.number().int(),
  chatType: z.string(),
  telegramUserId: z.number().int().positive(),
  username: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  languageCode: z.string().optional().nullable(),
  text: z.string().min(1),
  replyToMessageId: z.number().int().positive().optional().nullable(),
});

export const telegramConversationTurnSchema = z.object({
  telegramUserId: z.coerce.number().int().positive(),
  chatId: z.coerce.number().int(),
  role: z.enum(['user', 'bot']),
  turnType: z.enum([
    'diary_user',
    'diary_summary',
    'correction_user',
    'correction_ack',
    'system',
  ]),
  text: z.string().min(1),
  telegramMessageId: z.coerce.number().int().positive().optional().nullable(),
  replyToMessageId: z.coerce.number().int().positive().optional().nullable(),
  entryId: z.string().optional().nullable(),
});
