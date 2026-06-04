import type { AppLocale } from '@metrixify/shared-types';
import { isAppLocale } from '@metrixify/shared-types';
import type { FastifyRequest } from 'fastify';

export function resolveRequestLocale(
  request: FastifyRequest,
  userLocale?: string | null,
): AppLocale {
  if (userLocale && isAppLocale(userLocale)) {
    return userLocale;
  }

  const query = request.query as { locale?: string } | undefined;
  if (query?.locale && isAppLocale(query.locale)) {
    return query.locale;
  }

  const header = request.headers['accept-language'];
  if (typeof header === 'string') {
    const primary = header.split(',')[0]?.trim().toLowerCase();
    if (primary?.startsWith('uk')) {
      return 'uk';
    }
  }

  return 'en';
}

/** Prefer active UI locale (query / Accept-Language) over stored user default for LLM-generated copy. */
export function resolveContentGenerationLocale(
  request: FastifyRequest,
  userLocale?: string | null,
): AppLocale {
  const query = request.query as { locale?: string } | undefined;
  if (query?.locale && isAppLocale(query.locale)) {
    return query.locale;
  }

  const header = request.headers['accept-language'];
  if (typeof header === 'string') {
    const primary = header.split(',')[0]?.trim().toLowerCase();
    if (primary?.startsWith('uk')) {
      return 'uk';
    }
    if (primary?.startsWith('en')) {
      return 'en';
    }
  }

  if (userLocale && isAppLocale(userLocale)) {
    return userLocale;
  }

  return 'en';
}
