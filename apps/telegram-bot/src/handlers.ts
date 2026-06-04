import type { Context } from 'grammy';
import type { AppLocale } from '@metrixify/shared-types';
import { getFrontendUrl } from '@metrixify/config';
import {
  fetchCorrelationsSnapshot,
  fetchInsightsSnapshot,
  fetchRecentEntries,
  requestLoginLink,
  updateUserLocale,
} from './api/backend-client.js';
import { getIntroImageInputFile } from './brand-assets.js';
import { safeAnswerCallbackQuery } from './callback-query.js';
import { formatCorrelationsSnapshot, formatInsightsSnapshot } from './format-snapshots.js';
import { resolveUserLocale } from './locale.js';
import { getMessages } from './messages/index.js';
import {
  correlationsPageKeyboard,
  insightsPageKeyboard,
  languageKeyboard,
  loginLinkKeyboard,
  mainMenuKeyboard,
} from './menu.js';
import { withHtmlReply } from './telegram-format.js';
import { isTelegramInlineUrlAllowed, webAppHint } from './telegram-url.js';

function isPrivateChat(chatType: string): boolean {
  return chatType === 'private';
}

async function localeForContext(ctx: Context): Promise<AppLocale> {
  const from = ctx.from;
  if (!from) {
    return 'en';
  }
  return resolveUserLocale(from.id);
}

export async function replyWithMenu(
  ctx: Context,
  text: string,
  locale?: AppLocale,
): Promise<void> {
  const resolvedLocale = locale ?? (await localeForContext(ctx));
  await ctx.reply(text, withHtmlReply({ reply_markup: mainMenuKeyboard(resolvedLocale) }));
}

export async function handleStart(ctx: Context): Promise<void> {
  const locale = await localeForContext(ctx);
  const messages = getMessages(locale);
  const introImage = getIntroImageInputFile();

  if (introImage) {
    try {
      await ctx.replyWithPhoto(introImage, {
        caption: messages.MSG_START,
        ...withHtmlReply({ reply_markup: mainMenuKeyboard(locale) }),
      });
      return;
    } catch (error) {
      console.error('[telegram-bot] intro photo failed, falling back to text', error);
    }
  }

  await replyWithMenu(ctx, messages.MSG_START, locale);
}

export async function handleHelp(ctx: Context): Promise<void> {
  const locale = await localeForContext(ctx);
  const messages = getMessages(locale);
  await replyWithMenu(ctx, messages.MSG_HELP, locale);
}

export async function handleLogin(ctx: Context): Promise<void> {
  const from = ctx.from;
  const chat = ctx.chat;

  if (!from || !chat) {
    return;
  }

  const locale = await localeForContext(ctx);
  const messages = getMessages(locale);

  if (!isPrivateChat(chat.type)) {
    await ctx.reply(messages.MSG_PRIVATE_ONLY);
    return;
  }

  try {
    const { loginUrl } = await requestLoginLink({
      telegramUserId: from.id,
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      languageCode: from.language_code,
    });
    await ctx.reply(
      messages.formatLoginLink(loginUrl),
      withHtmlReply({ reply_markup: loginLinkKeyboard(locale, loginUrl) }),
    );
  } catch (error) {
    console.error('[telegram-bot] login failed', error);
    await ctx.reply(messages.MSG_LOGIN_FAILED, { reply_markup: mainMenuKeyboard(locale) });
  }
}

export async function handleStatus(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) {
    return;
  }

  const locale = await localeForContext(ctx);
  const messages = getMessages(locale);

  try {
    const items = await fetchRecentEntries(from.id);
    if (items.length === 0) {
      await ctx.reply(messages.MSG_NO_ENTRIES, { reply_markup: mainMenuKeyboard(locale) });
      return;
    }
    await ctx.reply(
      `${messages.formatStatusHeader(items.length)}\n\n${messages.formatStatusList(items)}`,
      withHtmlReply({ reply_markup: mainMenuKeyboard(locale) }),
    );
  } catch (error) {
    console.error('[telegram-bot] status failed', error);
    await ctx.reply(messages.MSG_PROCESSING_FAILED, { reply_markup: mainMenuKeyboard(locale) });
  }
}

export async function handleCorrelations(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) {
    return;
  }

  const locale = await localeForContext(ctx);
  const messages = getMessages(locale);

  try {
    const data = await fetchCorrelationsSnapshot(from.id);
    const pageUrl = `${getFrontendUrl()}/correlations`;
    const text =
      formatCorrelationsSnapshot(locale, data) +
      (isTelegramInlineUrlAllowed(pageUrl) ? '' : webAppHint(locale));
    await ctx.reply(text, {
      ...withHtmlReply({ reply_markup: correlationsPageKeyboard(locale, pageUrl) }),
    });
  } catch (error) {
    console.error('[telegram-bot] correlations failed', error);
    await ctx.reply(messages.MSG_PROCESSING_FAILED, { reply_markup: mainMenuKeyboard(locale) });
  }
}

export async function handleInsights(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) {
    return;
  }

  const locale = await localeForContext(ctx);
  const messages = getMessages(locale);

  try {
    const data = await fetchInsightsSnapshot(from.id);
    const pageUrl = `${getFrontendUrl()}/insights`;
    const text =
      formatInsightsSnapshot(locale, data) +
      (isTelegramInlineUrlAllowed(pageUrl) ? '' : webAppHint(locale));
    await ctx.reply(text, {
      ...withHtmlReply({ reply_markup: insightsPageKeyboard(locale, pageUrl) }),
    });
  } catch (error) {
    console.error('[telegram-bot] insights failed', error);
    await ctx.reply(messages.MSG_PROCESSING_FAILED, { reply_markup: mainMenuKeyboard(locale) });
  }
}

export async function handleLanguage(ctx: Context): Promise<void> {
  const locale = await localeForContext(ctx);
  const messages = getMessages(locale);
  await ctx.reply(messages.MSG_LANGUAGE_PROMPT, { reply_markup: languageKeyboard() });
}

export async function handleLanguageCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  const from = ctx.from;

  if (!data?.startsWith('lang:') || !from) {
    return;
  }

  const selectedLocale: AppLocale = data === 'lang:uk' ? 'uk' : 'en';

  await safeAnswerCallbackQuery(ctx);

  try {
    await updateUserLocale({
      telegramUserId: from.id,
      locale: selectedLocale,
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      languageCode: from.language_code,
    });
  } catch (error) {
    console.error('[telegram-bot] language update failed', error);
    const messages = getMessages(await localeForContext(ctx));
    await ctx.reply(messages.MSG_PROCESSING_FAILED, {
      reply_markup: mainMenuKeyboard(await localeForContext(ctx)),
    });
    return;
  }

  const messages = getMessages(selectedLocale);
  const confirmation =
    selectedLocale === 'uk' ? messages.MSG_LANGUAGE_UPDATED_UK : messages.MSG_LANGUAGE_UPDATED_EN;
  await ctx.reply(confirmation, { reply_markup: mainMenuKeyboard(selectedLocale) });
}

export async function handleMenuCallback(ctx: Context): Promise<void> {
  const data = ctx.callbackQuery?.data;
  if (!data?.startsWith('menu:')) {
    return;
  }

  await safeAnswerCallbackQuery(ctx);

  const action = data.slice('menu:'.length);
  switch (action) {
    case 'status':
      await handleStatus(ctx);
      break;
    case 'login':
      await handleLogin(ctx);
      break;
    case 'help':
      await handleHelp(ctx);
      break;
    case 'language':
      await handleLanguage(ctx);
      break;
    case 'correlations':
      await handleCorrelations(ctx);
      break;
    case 'insights':
      await handleInsights(ctx);
      break;
    default:
      break;
  }
}
