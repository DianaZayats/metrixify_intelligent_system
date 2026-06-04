import type { AppLocale } from '@metrixify/shared-types';
import {
  findUserByTelegramId,
  type TelegramProfile,
  updateUserLocale,
  upsertUserFromTelegram,
} from '../users/user.repository.js';

function normalizeLocale(locale: string): AppLocale {
  return locale === 'uk' ? 'uk' : 'en';
}

export async function getTelegramUserLocale(telegramUserId: bigint): Promise<AppLocale> {
  const user = await findUserByTelegramId(telegramUserId);
  if (!user) {
    return 'en';
  }
  return normalizeLocale(user.locale);
}

export async function updateTelegramUserLocale(
  telegramUserId: bigint,
  locale: AppLocale,
  profile?: Omit<TelegramProfile, 'telegramUserId'>,
): Promise<AppLocale> {
  let user = await findUserByTelegramId(telegramUserId);
  if (!user) {
    user = await upsertUserFromTelegram({
      telegramUserId,
      username: profile?.username,
      firstName: profile?.firstName,
      lastName: profile?.lastName,
      languageCode: profile?.languageCode,
    });
  }

  const updated = await updateUserLocale(user.id, locale);
  return normalizeLocale(updated.locale);
}
