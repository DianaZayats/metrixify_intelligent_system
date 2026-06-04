import type { Context } from 'grammy';
import type { InlineKeyboard } from 'grammy';
import { getFrontendUrl } from '@metrixify/config';
import type { TelegramRouteMessageResponse } from '@metrixify/shared-types';
import { appendTelegramConversationTurn, saveTelegramSummaryMessage } from './api/backend-client.js';
import { getMessages } from './messages/index.js';
import { journalLinkKeyboard } from './menu.js';
import { stripHtml, withHtmlReply } from './telegram-format.js';
import { isTelegramInlineUrlAllowed, webAppHint } from './telegram-url.js';
import type { AppLocale } from '@metrixify/shared-types';

type ReplyMarkupOptions = {
  reply_markup?: InlineKeyboard;
};

export async function sendEntryProcessingAck(
  ctx: Context,
  locale: AppLocale,
  inboundMessageId: number,
): Promise<number | undefined> {
  const messages = getMessages(locale);
  const sent = await ctx.reply(
    messages.MSG_ENTRY_PROCESSING,
    withHtmlReply({ reply_parameters: { message_id: inboundMessageId } }),
  );
  return sent.message_id;
}

export async function replaceBotMessage(
  ctx: Context,
  messageId: number | undefined,
  text: string,
  options?: ReplyMarkupOptions,
  useHtml = true,
): Promise<number | undefined> {
  const extra = useHtml ? withHtmlReply(options) : options;

  if (messageId && ctx.chat?.id) {
    await ctx.api.editMessageText(ctx.chat.id, messageId, text, extra);
    return messageId;
  }

  const sent = await ctx.reply(text, extra);
  return sent.message_id;
}

type DiaryIngestResult = Extract<TelegramRouteMessageResponse, { kind: 'diary_entry' }>;

export async function replyWithEntrySummary(
  ctx: Context,
  locale: AppLocale,
  result: DiaryIngestResult,
  inboundMessageId: number,
  processingMessageId?: number,
): Promise<void> {
  const messages = getMessages(locale);
  const journalUrl = `${getFrontendUrl()}/journal`;
  const text =
    messages.formatEntrySavedSummary({
      observations: result.observations,
      processingStatus: result.processingStatus,
      journalUrl,
    }) + (isTelegramInlineUrlAllowed(journalUrl) ? '' : webAppHint(locale));
  const keyboard = journalLinkKeyboard(locale, journalUrl);

  const summaryMessageId = await replaceBotMessage(ctx, processingMessageId, text, {
    reply_markup: keyboard,
  });

  if (!ctx.from || !summaryMessageId || !ctx.chat) {
    return;
  }

  const plainText = stripHtml(text);

  try {
    await saveTelegramSummaryMessage({
      entryId: result.entryId,
      telegramUserId: ctx.from.id,
      chatId: ctx.chat.id,
      inboundMessageId,
      summaryMessageId,
    });
    await appendTelegramConversationTurn({
      telegramUserId: ctx.from.id,
      chatId: ctx.chat.id,
      role: 'bot',
      turnType: 'diary_summary',
      text: plainText,
      telegramMessageId: summaryMessageId,
      replyToMessageId: inboundMessageId,
      entryId: result.entryId,
    });
  } catch (error) {
    console.error('[telegram-bot] failed to persist summary message id', error);
  }
}

export async function replyWithCorrectionStub(
  ctx: Context,
  result: Extract<TelegramRouteMessageResponse, { kind: 'correction' }>,
  inboundMessageId: number,
  processingMessageId?: number,
): Promise<void> {
  const summaryMessageId = await replaceBotMessage(
    ctx,
    processingMessageId,
    result.replyText,
    undefined,
    false,
  );

  if (!ctx.from || !summaryMessageId || !ctx.chat) {
    return;
  }

  try {
    await appendTelegramConversationTurn({
      telegramUserId: ctx.from.id,
      chatId: ctx.chat.id,
      role: 'bot',
      turnType: 'correction_ack',
      text: result.replyText,
      telegramMessageId: summaryMessageId,
      replyToMessageId: inboundMessageId,
      entryId: result.entryId,
    });
  } catch (error) {
    console.error('[telegram-bot] failed to persist correction ack turn', error);
  }
}
