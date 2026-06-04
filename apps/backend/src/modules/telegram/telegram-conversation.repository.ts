import type {
  TelegramConversationRole,
  TelegramConversationTurn,
  TelegramConversationTurnType,
} from '@prisma/client';
import { prisma } from '../../shared/db/prisma.js';

export type AppendConversationTurnInput = {
  userId: string;
  chatId: bigint;
  role: TelegramConversationRole;
  turnType: TelegramConversationTurnType;
  text: string;
  telegramMessageId?: bigint | null;
  replyToMessageId?: bigint | null;
  entryId?: string | null;
};

export async function appendConversationTurn(
  input: AppendConversationTurnInput,
): Promise<TelegramConversationTurn | null> {
  if (input.telegramMessageId != null) {
    const existing = await prisma.telegramConversationTurn.findUnique({
      where: {
        chatId_telegramMessageId: {
          chatId: input.chatId,
          telegramMessageId: input.telegramMessageId,
        },
      },
    });
    if (existing) {
      return existing;
    }
  }

  return prisma.telegramConversationTurn.create({
    data: {
      userId: input.userId,
      chatId: input.chatId,
      role: input.role,
      turnType: input.turnType,
      text: input.text,
      telegramMessageId: input.telegramMessageId ?? null,
      replyToMessageId: input.replyToMessageId ?? null,
      entryId: input.entryId ?? null,
    },
  });
}

export async function listRecentConversationTurns(
  userId: string,
  chatId: bigint,
  take = 20,
): Promise<TelegramConversationTurn[]> {
  return prisma.telegramConversationTurn.findMany({
    where: { userId, chatId },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export function toConversationTurnItem(turn: TelegramConversationTurn) {
  return {
    id: turn.id,
    role: turn.role,
    turnType: turn.turnType,
    text: turn.text,
    telegramMessageId:
      turn.telegramMessageId != null ? Number(turn.telegramMessageId) : null,
    replyToMessageId:
      turn.replyToMessageId != null ? Number(turn.replyToMessageId) : null,
    entryId: turn.entryId,
    createdAt: turn.createdAt.toISOString(),
  };
}
