import type { AppLocale } from '@metrixify/shared-types';
import { fetchUserLocale } from './api/backend-client.js';

export async function resolveUserLocale(telegramUserId: number): Promise<AppLocale> {
  try {
    const { locale } = await fetchUserLocale(telegramUserId);
    return locale === 'uk' ? 'uk' : 'en';
  } catch (error) {
    console.error('[telegram-bot] failed to resolve user locale', error);
    return 'en';
  }
}
