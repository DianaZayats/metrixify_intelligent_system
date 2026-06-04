import { InlineKeyboard } from 'grammy';
import type { Api, RawApi } from 'grammy';
import type { AppLocale } from '@metrixify/shared-types';
import { isTelegramInlineUrlAllowed } from './telegram-url.js';

/** Shown in Telegram’s command menu (tap “/” next to the input field). */
export function getBotCommands(locale: AppLocale) {
  if (locale === 'uk') {
    return [
      { command: 'start', description: 'Вітання та меню' },
      { command: 'help', description: 'Як користуватися Metrixify' },
      { command: 'login', description: 'Увійти у веб-додаток' },
      { command: 'status', description: 'Останні записи щоденника' },
      { command: 'correlations', description: 'Топ кореляції метрик' },
      { command: 'insights', description: 'Останні AI-інсайти' },
      { command: 'language', description: 'Змінити мову інтерфейсу' },
    ] as const;
  }

  return [
    { command: 'start', description: 'Welcome and menu' },
    { command: 'help', description: 'How to use Metrixify' },
    { command: 'login', description: 'Sign in to the web app' },
    { command: 'status', description: 'Your last diary entries' },
    { command: 'correlations', description: 'Top metric correlations' },
    { command: 'insights', description: 'Latest AI insights' },
    { command: 'language', description: 'Change interface language' },
  ] as const;
}

const BOT_PROFILE = {
  en: {
    description:
      'Metrixify — personal diary via Telegram. Send text or voice notes; AI extracts metrics, correlations, and insights for your web journal.',
    shortDescription: 'Diary, metrics, correlations, and insights.',
  },
  uk: {
    description:
      'AI Diary Bot — особистий щоденник у Telegram. Надсилай текст або голосові — AI створить резюме, витягне метрики, порахує кореляції та підкаже інсайти. Переглядай у веб-щоденнику через /login.',
    shortDescription:
      'AI Diary Bot — інтелектуальний щоденник. Текст і голос → метрики, кореляції та інсайти у веб.',
  },
} as const;

export const MENU_CALLBACK = {
  status: 'menu:status',
  login: 'menu:login',
  help: 'menu:help',
  correlations: 'menu:correlations',
  insights: 'menu:insights',
} as const;

export const LANGUAGE_CALLBACK = {
  en: 'lang:en',
  uk: 'lang:uk',
} as const;

function journalButtonLabel(locale: AppLocale): string {
  return locale === 'uk' ? '📓 Відкрити щоденник' : '📓 Open journal';
}

function loginButtonLabel(locale: AppLocale): string {
  return locale === 'uk' ? '🔐 Відкрити Metrixify' : '🔐 Open Metrixify';
}

function correlationsButtonLabel(locale: AppLocale): string {
  return locale === 'uk' ? '📈 Кореляції у веб' : '📈 Correlations in web';
}

function insightsButtonLabel(locale: AppLocale): string {
  return locale === 'uk' ? '💡 Інсайти у веб' : '💡 Insights in web';
}

export function mainMenuKeyboard(locale: AppLocale): InlineKeyboard {
  if (locale === 'uk') {
    return new InlineKeyboard()
      .text('📊 Останні записи', MENU_CALLBACK.status)
      .text('🔐 Вхід у веб', MENU_CALLBACK.login)
      .row()
      .text('🔗 Кореляції', MENU_CALLBACK.correlations)
      .text('💡 Інсайти', MENU_CALLBACK.insights)
      .row()
      .text('❓ Довідка', MENU_CALLBACK.help)
      .text('🌐 Мова', 'menu:language');
  }

  return new InlineKeyboard()
    .text('📊 Recent entries', MENU_CALLBACK.status)
    .text('🔐 Web sign-in', MENU_CALLBACK.login)
    .row()
    .text('🔗 Correlations', MENU_CALLBACK.correlations)
    .text('💡 Insights', MENU_CALLBACK.insights)
    .row()
    .text('❓ Help', MENU_CALLBACK.help)
    .text('🌐 Language', 'menu:language');
}

export function journalLinkKeyboard(locale: AppLocale, journalUrl: string): InlineKeyboard {
  const menu = mainMenuKeyboard(locale);
  if (!isTelegramInlineUrlAllowed(journalUrl)) {
    return menu;
  }
  return new InlineKeyboard().url(journalButtonLabel(locale), journalUrl).append(menu);
}

export function loginLinkKeyboard(locale: AppLocale, loginUrl: string): InlineKeyboard {
  const menu = mainMenuKeyboard(locale);
  if (!isTelegramInlineUrlAllowed(loginUrl)) {
    return menu;
  }
  return new InlineKeyboard().url(loginButtonLabel(locale), loginUrl).append(menu);
}

export function correlationsPageKeyboard(locale: AppLocale, pageUrl: string): InlineKeyboard {
  const menu = mainMenuKeyboard(locale);
  if (!isTelegramInlineUrlAllowed(pageUrl)) {
    return menu;
  }
  return new InlineKeyboard().url(correlationsButtonLabel(locale), pageUrl).append(menu);
}

export function insightsPageKeyboard(locale: AppLocale, pageUrl: string): InlineKeyboard {
  const menu = mainMenuKeyboard(locale);
  if (!isTelegramInlineUrlAllowed(pageUrl)) {
    return menu;
  }
  return new InlineKeyboard().url(insightsButtonLabel(locale), pageUrl).append(menu);
}

export function languageKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('English', LANGUAGE_CALLBACK.en)
    .text('Українська', LANGUAGE_CALLBACK.uk);
}

type SetMyCommandsApi = Pick<Api<RawApi>, 'setMyCommands'>;
type SetBotProfileApi = Pick<Api<RawApi>, 'setMyDescription' | 'setMyShortDescription'>;

export async function registerBotCommandMenu(api: SetMyCommandsApi): Promise<void> {
  for (const locale of ['en', 'uk'] as const) {
    await api.setMyCommands(
      getBotCommands(locale).map((entry) => ({
        command: entry.command,
        description: entry.description,
      })),
      { language_code: locale },
    );
  }
}

export async function registerBotProfile(api: SetBotProfileApi): Promise<void> {
  for (const locale of ['en', 'uk'] as const) {
    await api.setMyDescription(BOT_PROFILE[locale].description, { language_code: locale });
    await api.setMyShortDescription(BOT_PROFILE[locale].shortDescription, { language_code: locale });
  }
}
