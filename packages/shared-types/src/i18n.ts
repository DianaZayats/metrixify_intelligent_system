export const APP_LOCALES = ['en', 'uk'] as const;
export type AppLocale = (typeof APP_LOCALES)[number];

export type LocalizedString = {
  en: string;
  uk?: string;
};

export type TagsI18nMap = Record<string, LocalizedString>;

export function isAppLocale(value: string): value is AppLocale {
  return (APP_LOCALES as readonly string[]).includes(value);
}

export function resolveLocalized(
  value: LocalizedString | null | undefined,
  locale: AppLocale,
  fallback?: string | null,
): string {
  if (value) {
    if (locale === 'uk' && value.uk?.trim()) {
      return value.uk.trim();
    }
    if (value.en?.trim()) {
      return value.en.trim();
    }
  }
  return fallback?.trim() ?? '';
}

export function parseLocalizedString(raw: unknown): LocalizedString | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const record = raw as Record<string, unknown>;
  if (typeof record.en !== 'string') {
    return null;
  }
  const result: LocalizedString = { en: record.en.trim() };
  if (typeof record.uk === 'string' && record.uk.trim()) {
    result.uk = record.uk.trim();
  }
  return result;
}

export function parseTagsI18nMap(raw: unknown): TagsI18nMap | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const result: TagsI18nMap = {};
  for (const [slug, value] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = parseLocalizedString(value);
    if (parsed) {
      result[slug] = parsed;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

export function resolveTagLabel(
  slug: string,
  tagsI18n: TagsI18nMap | null | undefined,
  locale: AppLocale,
): string {
  const localized = tagsI18n?.[slug];
  if (localized) {
    return resolveLocalized(localized, locale, slug);
  }
  return slug;
}
