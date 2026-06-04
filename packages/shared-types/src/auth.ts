import type { AppLocale } from './i18n.js';

export type AuthUser = {
  id: string;
  timezone: string;
  locale: AppLocale;
  telegramUsername: string | null;
};

export type UpdateUserLocalePayload = {
  locale: AppLocale;
};

export type UpdateUserLocaleResponse = {
  locale: AppLocale;
};

export type AuthMeResponse = {
  user: AuthUser;
};

export type AuthTelegramTokenResponse = {
  user: AuthUser;
};

export type TelegramLoginLinkResponse = {
  loginUrl: string;
  expiresAt: string;
};

export type TelegramUserLocaleResponse = {
  locale: AppLocale;
};
