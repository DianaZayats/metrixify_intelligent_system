import type { AppLocale } from '@metrixify/shared-types';
import type { TelegramRouteMessageResponse } from '@metrixify/shared-types';
import { upsertUserFromTelegram } from '../users/user.repository.js';
import { ingestTelegramTextMessage } from '../entries/entry.service.js';
import type { TelegramIngestInput } from '../entries/entry.service.js';
import {
  findDiaryEntryByTelegramInboundMessageId,
  findDiaryEntryByTelegramSummaryMessageId,
} from '../entries/entry.repository.js';
import { prisma } from '../../shared/db/prisma.js';
import {
  appendConversationTurn,
  listRecentConversationTurns,
} from './telegram-conversation.repository.js';
import { buildRecentEntryRoutingContexts } from './telegram-message-routing-context.js';
import {
  classifyTelegramMessageWithAi,
  createDefaultTelegramRoutingDeps,
  type TelegramRoutingDeps,
} from './telegram-message-routing.service.js';
import {
  applyTelegramMetricCorrection,
  createDefaultTelegramCorrectionDeps,
  type TelegramCorrectionDeps,
} from './telegram-metric-correction.service.js';
import {
  formatCorrectionNoEntryReply,
} from './telegram-routing-replies.js';
import type { AppendConversationTurnInput } from './telegram-conversation.repository.js';
import type { z } from 'zod';
import type { telegramMessageRouteSchema } from './telegram.schemas.js';

export type TelegramMessageRouteInput = z.infer<typeof telegramMessageRouteSchema>;

export async function appendTelegramConversationTurnForUser(
  input: AppendConversationTurnInput & { telegramUserId: number },
): Promise<void> {
  const user = await upsertUserFromTelegram({
    telegramUserId: BigInt(input.telegramUserId),
  });

  await appendConversationTurn({
    userId: user.id,
    chatId: input.chatId,
    role: input.role,
    turnType: input.turnType,
    text: input.text,
    telegramMessageId: input.telegramMessageId ?? null,
    replyToMessageId: input.replyToMessageId ?? null,
    entryId: input.entryId ?? null,
  });
}

async function resolveEntryIdFromReply(
  userId: string,
  replyToMessageId: number,
  recentEntries: ReturnType<typeof buildRecentEntryRoutingContexts>,
): Promise<string | null> {
  const fromRecent = recentEntries.find(
    (entry) =>
      entry.summaryMessageId === replyToMessageId ||
      entry.inboundMessageId === replyToMessageId,
  )?.id;
  if (fromRecent) {
    return fromRecent;
  }

  const fromSummary = await findDiaryEntryByTelegramSummaryMessageId(
    userId,
    BigInt(replyToMessageId),
  );
  if (fromSummary) {
    return fromSummary.id;
  }

  const fromInbound = await findDiaryEntryByTelegramInboundMessageId(
    userId,
    BigInt(replyToMessageId),
  );
  return fromInbound?.id ?? null;
}

export async function routeTelegramTextMessage(
  input: TelegramMessageRouteInput,
  deps: TelegramRoutingDeps & TelegramCorrectionDeps = {
    ...createDefaultTelegramRoutingDeps(),
    ...createDefaultTelegramCorrectionDeps(),
  },
): Promise<TelegramRouteMessageResponse> {
  if (input.chatType !== 'private') {
    throw new Error('Only private chats are supported');
  }

  const user = await upsertUserFromTelegram({
    telegramUserId: BigInt(input.telegramUserId),
    username: input.username,
    firstName: input.firstName,
    lastName: input.lastName,
    languageCode: input.languageCode,
  });

  const chatId = BigInt(input.chatId);
  const recentTurns = await listRecentConversationTurns(user.id, chatId, 20);
  const recentEntriesRaw = await prisma.diaryEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      metricObservations: {
        include: {
          metricDefinition: {
            select: { title: true },
          },
        },
      },
    },
  });
  const recentEntries = buildRecentEntryRoutingContexts(recentEntriesRaw);

  let replyEntryId: string | null = null;
  if (input.replyToMessageId != null) {
    replyEntryId = await resolveEntryIdFromReply(
      user.id,
      input.replyToMessageId,
      recentEntries,
    );
  }

  const classification = await classifyTelegramMessageWithAi(
    {
      text: input.text,
      replyToMessageId: input.replyToMessageId,
      replyEntryId,
      recentTurns,
      recentEntries,
    },
    deps,
  );

  if (classification.kind === 'correction') {
    const locale: AppLocale = user.locale === 'uk' ? 'uk' : 'en';

    if (!classification.entryId) {
      const replyText = formatCorrectionNoEntryReply(locale);
      await appendConversationTurn({
        userId: user.id,
        chatId,
        role: 'user',
        turnType: 'correction_user',
        text: input.text.trim(),
        telegramMessageId: BigInt(input.messageId),
        replyToMessageId:
          input.replyToMessageId != null ? BigInt(input.replyToMessageId) : null,
        entryId: null,
      });

      return {
        kind: 'correction',
        entryId: null,
        entryDate: null,
        status: 'no_entry',
        replyText,
        observations: [],
      };
    }

    const correctionResult = await applyTelegramMetricCorrection(
      {
        userId: user.id,
        locale,
        userTimezone: user.timezone,
        entryId: classification.entryId,
        messageText: input.text,
        replyToMessageId: input.replyToMessageId,
        recentTurns,
      },
      deps,
    );

    await appendConversationTurn({
      userId: user.id,
      chatId,
      role: 'user',
      turnType: 'correction_user',
      text: input.text.trim(),
      telegramMessageId: BigInt(input.messageId),
      replyToMessageId:
        input.replyToMessageId != null ? BigInt(input.replyToMessageId) : null,
      entryId: correctionResult.entryId,
    });

    return {
      kind: 'correction',
      entryId: correctionResult.entryId,
      entryDate: correctionResult.entryDate,
      status: correctionResult.status,
      replyText: correctionResult.replyText,
      observations: correctionResult.observations,
    };
  }

  await appendConversationTurn({
    userId: user.id,
    chatId,
    role: 'user',
    turnType: 'diary_user',
    text: input.text.trim(),
    telegramMessageId: BigInt(input.messageId),
    replyToMessageId:
      input.replyToMessageId != null ? BigInt(input.replyToMessageId) : null,
  });

  const ingestInput: TelegramIngestInput = {
    updateId: input.updateId,
    messageId: input.messageId,
    chatId: input.chatId,
    chatType: input.chatType,
    telegramUserId: input.telegramUserId,
    username: input.username,
    firstName: input.firstName,
    lastName: input.lastName,
    languageCode: input.languageCode,
    text: input.text,
  };

  const ingestResult = await ingestTelegramTextMessage(ingestInput);

  return {
    kind: 'diary_entry',
    ...ingestResult,
  };
}
