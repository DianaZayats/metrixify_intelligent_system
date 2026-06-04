import type { InsightReport } from '@prisma/client';
import { prisma } from '../../shared/db/prisma.js';

export async function createInsightReport(params: {
  userId: string;
  locale: string;
  insightsJson: unknown;
  recommendationsJson: unknown;
  disclaimer: string | null;
  inputSummaryJson: Record<string, unknown>;
  correlationCalculatedAt: Date | null;
  model: string;
  promptVersion: string;
  aiRunId?: string;
}): Promise<InsightReport> {
  return prisma.insightReport.create({
    data: {
      userId: params.userId,
      locale: params.locale,
      insightsJson: params.insightsJson,
      recommendationsJson: params.recommendationsJson,
      disclaimer: params.disclaimer,
      inputSummaryJson: params.inputSummaryJson,
      correlationCalculatedAt: params.correlationCalculatedAt,
      model: params.model,
      promptVersion: params.promptVersion,
      aiRunId: params.aiRunId,
    },
  });
}

export async function findLatestInsightReport(userId: string): Promise<InsightReport | null> {
  return prisma.insightReport.findFirst({
    where: { userId },
    orderBy: { generatedAt: 'desc' },
  });
}

export async function findInsightReportById(
  userId: string,
  id: string,
): Promise<InsightReport | null> {
  return prisma.insightReport.findFirst({
    where: { id, userId },
  });
}

export async function listInsightReports(
  userId: string,
  limit: number,
): Promise<InsightReport[]> {
  return prisma.insightReport.findMany({
    where: { userId },
    orderBy: { generatedAt: 'desc' },
    take: limit,
  });
}

export async function countInsightReports(userId: string): Promise<number> {
  return prisma.insightReport.count({ where: { userId } });
}
