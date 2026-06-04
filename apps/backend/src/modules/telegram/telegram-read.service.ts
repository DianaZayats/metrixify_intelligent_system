import type {
  TelegramCorrelationsSnapshotResponse,
  TelegramInsightsSnapshotResponse,
} from '@metrixify/shared-types';
import { getAnalyticsCorrelations } from '../analytics/analytics.service.js';
import { getLatestInsightsForUser } from '../insights/insights.service.js';
import { upsertUserFromTelegram } from '../users/user.repository.js';
import { getTelegramUserLocale } from './telegram-locale.service.js';

const TELEGRAM_BODY_MAX = 180;
const DEFAULT_CORRELATION_LIMIT = 5;
const DEFAULT_INSIGHT_LIMIT = 3;
const DEFAULT_RECOMMENDATION_LIMIT = 2;

function truncateForTelegram(text: string, max = TELEGRAM_BODY_MAX): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= max) {
    return trimmed;
  }
  return `${trimmed.slice(0, max - 1)}…`;
}

export async function getTelegramCorrelationsSnapshot(
  telegramUserId: number,
  limit = DEFAULT_CORRELATION_LIMIT,
): Promise<TelegramCorrelationsSnapshotResponse> {
  const user = await upsertUserFromTelegram({
    telegramUserId: BigInt(telegramUserId),
  });
  const locale = await getTelegramUserLocale(BigInt(telegramUserId));
  const data = await getAnalyticsCorrelations(user.id, { method: 'pearson' }, locale);
  const sorted = [...data.items].sort(
    (a, b) => Math.abs(b.correlationValue) - Math.abs(a.correlationValue),
  );

  return {
    items: sorted.slice(0, limit).map((item) => ({
      metricATitle: item.metricATitle,
      metricBTitle: item.metricBTitle,
      correlationValue: item.correlationValue,
      lagDays: item.lagDays,
      sampleSize: item.sampleSize,
      exploratory: item.exploratory,
    })),
    total: data.items.length,
  };
}

export async function getTelegramInsightsSnapshot(
  telegramUserId: number,
): Promise<TelegramInsightsSnapshotResponse> {
  const user = await upsertUserFromTelegram({
    telegramUserId: BigInt(telegramUserId),
  });
  const locale = await getTelegramUserLocale(BigInt(telegramUserId));
  const { report } = await getLatestInsightsForUser(user.id, locale);

  if (!report) {
    return { report: null };
  }

  return {
    report: {
      generatedAt: report.generatedAt,
      insights: report.insights.slice(0, DEFAULT_INSIGHT_LIMIT).map((item) => ({
        title: item.title,
        body: truncateForTelegram(item.body),
        confidence: item.confidence,
      })),
      recommendations: report.recommendations.slice(0, DEFAULT_RECOMMENDATION_LIMIT).map((item) => ({
        title: item.title,
        body: truncateForTelegram(item.body),
      })),
    },
  };
}
