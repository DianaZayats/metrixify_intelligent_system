import type { CorrelationMethod, CorrelationResult, MetricDefinition } from '@prisma/client';
import { prisma } from '../../shared/db/prisma.js';
import type { ComputedCorrelation } from '@metrixify/analytics-core';
import { entryDateForTimezone } from '../../shared/lib/entry-date.js';
import { listObservationsForUser } from '../metrics/metric.repository.js';

export async function listActiveAnalyticsMetrics(userId: string): Promise<MetricDefinition[]> {
  return prisma.metricDefinition.findMany({
    where: {
      userId,
      status: 'active',
      valueType: { in: ['number', 'ordinal', 'boolean'] },
    },
    orderBy: { title: 'asc' },
  });
}

export async function listAllObservationsForAnalytics(userId: string) {
  return listObservationsForUser(userId, { limit: 10_000 });
}

export async function replaceUserCorrelationResults(
  userId: string,
  computed: ComputedCorrelation[],
): Promise<number> {
  await prisma.$transaction(async (tx) => {
    await tx.correlationResult.deleteMany({ where: { userId } });
    if (computed.length === 0) {
      return;
    }
    await tx.correlationResult.createMany({
      data: computed.map((item) => ({
        userId,
        metricAId: item.metricAId,
        metricBId: item.metricBId,
        method: item.method as CorrelationMethod,
        lagDays: item.lagDays,
        sampleSize: item.sampleSize,
        correlationValue: item.correlationValue,
        strengthLabel: item.strengthLabel,
        metadataJson: { exploratory: item.exploratory },
      })),
    });
  });
  return computed.length;
}

export async function listCorrelationResults(
  userId: string,
  filters?: {
    method?: CorrelationMethod;
    lagDays?: number;
    minSample?: number;
  },
): Promise<(CorrelationResult & { metricA: MetricDefinition; metricB: MetricDefinition })[]> {
  return prisma.correlationResult.findMany({
    where: {
      userId,
      ...(filters?.method ? { method: filters.method } : {}),
      ...(filters?.lagDays !== undefined ? { lagDays: filters.lagDays } : {}),
      ...(filters?.minSample ? { sampleSize: { gte: filters.minSample } } : {}),
    },
    include: { metricA: true, metricB: true },
    orderBy: [{ correlationValue: 'desc' }],
  });
}

export async function findCorrelationResultById(userId: string, id: string) {
  return prisma.correlationResult.findFirst({
    where: { id, userId },
    include: { metricA: true, metricB: true },
  });
}

export async function findAlternateCorrelationResult(params: {
  userId: string;
  metricAId: string;
  metricBId: string;
  lagDays: number;
  method: CorrelationMethod;
}) {
  return prisma.correlationResult.findFirst({
    where: {
      userId: params.userId,
      metricAId: params.metricAId,
      metricBId: params.metricBId,
      lagDays: params.lagDays,
      method: params.method,
    },
  });
}

export async function getLatestCorrelationCalculatedAt(userId: string): Promise<Date | null> {
  const row = await prisma.correlationResult.findFirst({
    where: { userId },
    orderBy: { calculatedAt: 'desc' },
    select: { calculatedAt: true },
  });
  return row?.calculatedAt ?? null;
}

export async function countCorrelationResults(userId: string): Promise<number> {
  return prisma.correlationResult.count({ where: { userId } });
}

export async function countEntriesLast7Days(userId: string, timezone: string): Promise<number> {
  const today = entryDateForTimezone(timezone);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 6);
  return prisma.diaryEntry.count({
    where: {
      userId,
      entryDate: { gte: start },
    },
  });
}

export async function listRecentEntriesForDashboard(userId: string, take = 5) {
  return prisma.diaryEntry.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      entryDate: true,
      summaryText: true,
      processingStatus: true,
    },
  });
}

export async function listDistinctEntryIdsForMetrics(
  userId: string,
  metricIds: string[],
  take = 5,
): Promise<string[]> {
  const rows = await prisma.metricObservation.findMany({
    where: {
      userId,
      metricDefinitionId: { in: metricIds },
    },
    select: { entryId: true },
    distinct: ['entryId'],
    take,
    orderBy: { observedAt: 'desc' },
  });
  return rows.map((row) => row.entryId);
}

export async function findEntriesByIds(userId: string, ids: string[]) {
  if (ids.length === 0) {
    return [];
  }
  return prisma.diaryEntry.findMany({
    where: { userId, id: { in: ids } },
    select: { id: true, entryDate: true, summaryText: true },
  });
}
