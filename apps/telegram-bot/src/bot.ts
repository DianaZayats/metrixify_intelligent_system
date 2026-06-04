import { Bot } from 'grammy';
import { getConfig } from '@metrixify/config';
import { routeTelegramMessage, ingestTelegramVoice } from './api/backend-client.js';
import {
  handleCorrelations,
  handleHelp,
  handleInsights,
  handleLanguage,
  handleLanguageCallback,
  handleLogin,
  handleMenuCallback,
  handleStart,
  handleStatus,
} from './handlers.js';
import { resolveUserLocale } from './locale.js';
import { getMessages } from './messages/index.js';
import { registerBotCommandMenu, registerBotProfile } from './menu.js';
import { replyWithCorrectionStub, replyWithEntrySummary, replaceBotMessage, sendEntryProcessingAck } from './reply-entry-summary.js';

const config = getConfig();

if (!config.TELEGRAM_BOT_TOKEN) {
  console.error(
    '[telegram-bot] TELEGRAM_BOT_TOKEN is missing. Create a bot via @BotFather and add the token to .env',
  );
  process.exit(1);
}

const bot = new Bot(config.TELEGRAM_BOT_TOKEN);

function isPrivateChat(chatType: string): boolean {
  return chatType === 'private';
}

bot.command('start', handleStart);
bot.command('help', handleHelp);
bot.command('login', handleLogin);
bot.command('status', handleStatus);
bot.command('correlations', handleCorrelations);
bot.command('insights', handleInsights);
bot.command('language', handleLanguage);

bot.callbackQuery(/^menu:/, handleMenuCallback);
bot.callbackQuery(/^lang:/, handleLanguageCallback);

bot.on('message:text', async (ctx) => {
  const message = ctx.message;
  const chat = ctx.chat;
  const from = ctx.from;

  if (!from || !message.text) {
    return;
  }

  const locale = await resolveUserLocale(from.id);
  const messages = getMessages(locale);

  if (!isPrivateChat(chat.type)) {
    await ctx.reply(messages.MSG_PRIVATE_ONLY);
    return;
  }

  if (message.text.startsWith('/')) {
    return;
  }

  let processingMessageId: number | undefined;

  try {
    processingMessageId = await sendEntryProcessingAck(ctx, locale, message.message_id);

    const result = await routeTelegramMessage({
      updateId: ctx.update.update_id,
      messageId: message.message_id,
      chatId: chat.id,
      chatType: chat.type,
      telegramUserId: from.id,
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      languageCode: from.language_code,
      text: message.text,
      replyToMessageId: message.reply_to_message?.message_id,
    });

    if (result.kind === 'correction') {
      await replyWithCorrectionStub(ctx, result, message.message_id, processingMessageId);
      return;
    }

    await replyWithEntrySummary(ctx, locale, result, message.message_id, processingMessageId);
  } catch (error) {
    console.error('[telegram-bot] text ingest failed', error);
    await replaceBotMessage(ctx, processingMessageId, messages.MSG_PROCESSING_FAILED);
  }
});

bot.on('message:voice', async (ctx) => {
  const message = ctx.message;
  const chat = ctx.chat;
  const from = ctx.from;
  const voice = message.voice;

  if (!from || !voice) {
    return;
  }

  const locale = await resolveUserLocale(from.id);
  const messages = getMessages(locale);

  if (!isPrivateChat(chat.type)) {
    await ctx.reply(messages.MSG_PRIVATE_ONLY);
    return;
  }

  let processingMessageId: number | undefined;

  try {
    processingMessageId = await sendEntryProcessingAck(ctx, locale, message.message_id);

    const result = await ingestTelegramVoice({
      updateId: ctx.update.update_id,
      messageId: message.message_id,
      chatId: chat.id,
      chatType: chat.type,
      telegramUserId: from.id,
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      languageCode: from.language_code,
      fileId: voice.file_id,
      duration: voice.duration,
    });

    if (result.transcribed) {
      await replyWithEntrySummary(ctx, locale, result, message.message_id, processingMessageId);
    } else {
      await replaceBotMessage(ctx, processingMessageId, messages.MSG_VOICE_TRANSCRIPTION_FAILED);
    }
  } catch (error) {
    console.error('[telegram-bot] voice ingest failed', error);
    await replaceBotMessage(ctx, processingMessageId, messages.MSG_PROCESSING_FAILED);
  }
});

bot.catch((error) => {
  const ctx = error.ctx;
  console.error('[telegram-bot] Unhandled error while processing update', {
    updateId: ctx.update.update_id,
    error,
  });
});

console.log('[telegram-bot] Starting long polling…');

bot.start({
  onStart: async () => {
    await registerBotCommandMenu(bot.api);
    await registerBotProfile(bot.api);
    console.log('[telegram-bot] Bot is running (command menu and profile registered)');
  },
});
