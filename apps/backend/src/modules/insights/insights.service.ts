import type { FastifyRequest } from 'fastify';
import type {
  AppLocale,
  DashboardInsightsFeed,
  GenerateInsightsResponse,
  InsightsListResponse,
  LatestInsightsResponse,
} from '@metrixify/shared-types';
import { ApiError } from '../../shared/errors/api-error.js';
import {
  resolveContentGenerationLocale,
} from '../../shared/locale/resolve-request-locale.js';
import { generateInsightsForUser } from './insights-generation.service.js';
import { toInsightReportDetail } from './insights.mapper.js';
import {
  countInsightReports,
  findInsightReportById,
  findLatestInsightReport,
  listInsightReports,
} from './insights.repository.js';
import { DASHBOARD_INSIGHT_REPORTS_LIMIT } from './insights.schemas.js';

export async function getLatestInsightsForUser(
  userId: string,
  locale: AppLocale,
): Promise<LatestInsightsResponse> {
  const report = await findLatestInsightReport(userId);
  return {
    report: report ? toInsightReportDetail(report, locale) : null,
  };
}

export async function listInsightsForUser(
  userId: string,
  limit: number,
  locale: AppLocale,
): Promise<InsightsListResponse> {
  const [items, total] = await Promise.all([
    listInsightReports(userId, limit),
    countInsightReports(userId),
  ]);
  return {
    items: items.map((item) => toInsightReportDetail(item, locale)),
    total,
  };
}

export async function getDashboardInsightsFeed(
  userId: string,
  locale: AppLocale,
): Promise<DashboardInsightsFeed> {
  const reports = await listInsightReports(userId, DASHBOARD_INSIGHT_REPORTS_LIMIT);
  return {
    hasReports: reports.length > 0,
    latestGeneratedAt: reports[0]?.generatedAt.toISOString() ?? null,
    reports: reports.map((item) => toInsightReportDetail(item, locale)),
  };
}

export async function getInsightReportForUser(
  userId: string,
  id: string,
  locale: AppLocale,
): Promise<GenerateInsightsResponse> {
  const report = await findInsightReportById(userId, id);
  if (!report) {
    throw new ApiError(404, 'NOT_FOUND', 'Insight report not found');
  }
  return { report: toInsightReportDetail(report, locale) };
}

export async function generateInsightsForSessionUser(params: {
  request: FastifyRequest;
  userId: string;
  userLocale: string | null | undefined;
  timezone: string;
}): Promise<GenerateInsightsResponse> {
  const locale = resolveContentGenerationLocale(params.request, params.userLocale);
  const report = await generateInsightsForUser({
    userId: params.userId,
    locale,
    timezone: params.timezone,
  });
  return { report };
}

export function resolveInsightsViewLocale(
  request: FastifyRequest,
  userLocale?: string | null,
): AppLocale {
  return resolveContentGenerationLocale(request, userLocale);
}
