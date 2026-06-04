import type { InsightReport } from '@prisma/client';
import type { AppLocale, LocalizedString } from '@metrixify/shared-types';
import {
  INSIGHT_CONFIDENCE_LEVELS,
  parseLocalizedString,
  resolveLocalized,
} from '@metrixify/shared-types';
import type {
  InsightItem,
  InsightReportDetail,
  RecommendationItem,
} from '@metrixify/shared-types';

type StoredInsightItem = {
  id: string;
  title?: string;
  body?: string;
  titleI18n?: LocalizedString;
  bodyI18n?: LocalizedString;
  confidence?: string;
  correlationIds?: string[];
};

type StoredRecommendationItem = {
  id: string;
  title?: string;
  body?: string;
  titleI18n?: LocalizedString;
  bodyI18n?: LocalizedString;
  relatedInsightIds?: string[];
};

function readLocalizedField(
  record: Record<string, unknown>,
  i18nKey: string,
  legacyKey: string,
): LocalizedString | null {
  const fromI18n = parseLocalizedString(record[i18nKey]);
  if (fromI18n) {
    return fromI18n;
  }

  const legacy = record[legacyKey];
  if (typeof legacy === 'string' && legacy.trim()) {
    return { en: legacy.trim(), uk: legacy.trim() };
  }

  return null;
}

function resolveStoredText(
  localized: LocalizedString | null,
  locale: AppLocale,
  fallback = '',
): string {
  if (!localized) {
    return fallback;
  }
  return resolveLocalized(localized, locale, localized.en);
}

function parseStoredInsightItems(raw: unknown): StoredInsightItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const record = item as Record<string, unknown>;
    const confidence = record.confidence;
    if (
      typeof record.id !== 'string' ||
      typeof confidence !== 'string' ||
      !INSIGHT_CONFIDENCE_LEVELS.includes(confidence as StoredInsightItem['confidence'])
    ) {
      return [];
    }

    const titleI18n = readLocalizedField(record, 'titleI18n', 'title');
    const bodyI18n = readLocalizedField(record, 'bodyI18n', 'body');
    if (!titleI18n || !bodyI18n) {
      return [];
    }

    const correlationIds = Array.isArray(record.correlationIds)
      ? record.correlationIds.filter((id): id is string => typeof id === 'string')
      : [];

    return [
      {
        id: record.id,
        titleI18n,
        bodyI18n,
        confidence,
        correlationIds,
      },
    ];
  });
}

function parseStoredRecommendationItems(raw: unknown): StoredRecommendationItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const record = item as Record<string, unknown>;
    if (typeof record.id !== 'string') {
      return [];
    }

    const titleI18n = readLocalizedField(record, 'titleI18n', 'title');
    const bodyI18n = readLocalizedField(record, 'bodyI18n', 'body');
    if (!titleI18n || !bodyI18n) {
      return [];
    }

    const relatedInsightIds = Array.isArray(record.relatedInsightIds)
      ? record.relatedInsightIds.filter((id): id is string => typeof id === 'string')
      : [];

    return [{ id: record.id, titleI18n, bodyI18n, relatedInsightIds }];
  });
}

function toInsightItem(item: StoredInsightItem, locale: AppLocale): InsightItem {
  return {
    id: item.id,
    title: resolveStoredText(item.titleI18n ?? null, locale),
    body: resolveStoredText(item.bodyI18n ?? null, locale),
    confidence: item.confidence as InsightItem['confidence'],
    correlationIds: item.correlationIds ?? [],
  };
}

function toRecommendationItem(item: StoredRecommendationItem, locale: AppLocale): RecommendationItem {
  return {
    id: item.id,
    title: resolveStoredText(item.titleI18n ?? null, locale),
    body: resolveStoredText(item.bodyI18n ?? null, locale),
    relatedInsightIds: item.relatedInsightIds ?? [],
  };
}

function parseDisclaimer(raw: string | null, locale: AppLocale): string | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const localized = parseLocalizedString(parsed);
    if (localized) {
      return resolveLocalized(localized, locale, localized.en);
    }
  } catch {
    // Legacy plain-text disclaimer
  }

  return raw;
}

function parseInputSummary(raw: unknown): InsightReportDetail['inputSummary'] {
  if (!raw || typeof raw !== 'object') {
    return { profileFactCount: 0, correlationCount: 0 };
  }
  const record = raw as Record<string, unknown>;
  return {
    profileFactCount: typeof record.profileFactCount === 'number' ? record.profileFactCount : 0,
    correlationCount: typeof record.correlationCount === 'number' ? record.correlationCount : 0,
  };
}

export function toInsightReportDetail(report: InsightReport, locale: AppLocale): InsightReportDetail {
  const storedInsights = parseStoredInsightItems(report.insightsJson);
  const storedRecommendations = parseStoredRecommendationItems(report.recommendationsJson);

  return {
    id: report.id,
    locale: report.locale,
    generatedAt: report.generatedAt.toISOString(),
    correlationCalculatedAt: report.correlationCalculatedAt?.toISOString() ?? null,
    insights: storedInsights.map((item) => toInsightItem(item, locale)),
    recommendations: storedRecommendations.map((item) => toRecommendationItem(item, locale)),
    disclaimer: parseDisclaimer(report.disclaimer, locale),
    inputSummary: parseInputSummary(report.inputSummaryJson),
    model: report.model,
    promptVersion: report.promptVersion,
  };
}
