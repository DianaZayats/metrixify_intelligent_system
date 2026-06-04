import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getInternalApiKey, resetConfigCache } from '@metrixify/config';
import { buildApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { SESSION_COOKIE_NAME } from '../auth/auth.constants.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const telegramUserId = 9_010_001;

describe.skipIf(!hasDatabase)('analytics API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let userId: string;
  const internalKey = process.env.SESSION_SECRET ?? 'test-secret-key-32chars-minimum!!';

  beforeAll(async () => {
    process.env.SESSION_SECRET = internalKey;
    resetConfigCache();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    if (userId) {
      await prisma.correlationResult.deleteMany({ where: { userId } });
      await prisma.metricObservation.deleteMany({ where: { userId } });
      await prisma.metricDefinition.deleteMany({ where: { userId } });
      await prisma.diaryEntry.deleteMany({ where: { userId } });
      await prisma.session.deleteMany({ where: { userId } });
      await prisma.telegramAccount.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await app.close();
    await prisma.$disconnect();
  });

  async function authCookies(): Promise<Record<string, string>> {
    const linkRes = await app.inject({
      method: 'POST',
      url: '/api/internal/telegram/login-link',
      headers: { 'x-metrixify-internal-key': getInternalApiKey() },
      payload: { telegramUserId },
    });
    const { loginUrl } = linkRes.json() as { loginUrl: string };
    const token = new URL(loginUrl).searchParams.get('token');
    const auth = await app.inject({
      method: 'POST',
      url: '/api/auth/telegram-token',
      payload: { token },
    });
    const setCookie = auth.headers['set-cookie'];
    const header = Array.isArray(setCookie) ? setCookie.join(';') : setCookie;
    const match = header?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    if (!match?.[1]) {
      throw new Error('Session cookie not set');
    }
    return { [SESSION_COOKIE_NAME]: match[1] };
  }

  async function seedCorrelatedMetrics(targetUserId: string): Promise<void> {
    const metricA = await prisma.metricDefinition.create({
      data: {
        userId: targetUserId,
        key: 'analytics_test_sleep',
        title: 'Sleep quality',
        valueType: 'ordinal',
        scaleMin: 1,
        scaleMax: 5,
        status: 'active',
      },
    });
    const metricB = await prisma.metricDefinition.create({
      data: {
        userId: targetUserId,
        key: 'analytics_test_energy',
        title: 'Energy',
        valueType: 'ordinal',
        scaleMin: 1,
        scaleMax: 5,
        status: 'active',
      },
    });

    for (let day = 0; day < 14; day += 1) {
      const entryDate = new Date(Date.UTC(2026, 0, 1 + day, 12, 0, 0));
      const entry = await prisma.diaryEntry.create({
        data: {
          userId: targetUserId,
          entryDate,
          rawText: `Day ${day} analytics seed`,
          sourceType: 'manual',
          processingStatus: 'completed',
        },
      });
      const value = 1 + (day % 5);
      await prisma.metricObservation.createMany({
        data: [
          {
            userId: targetUserId,
            entryId: entry.id,
            metricDefinitionId: metricA.id,
            observedAt: entryDate,
            valueNumber: value,
            confidence: 0.9,
            evidenceText: 'seed',
          },
          {
            userId: targetUserId,
            entryId: entry.id,
            metricDefinitionId: metricB.id,
            observedAt: entryDate,
            valueNumber: value,
            confidence: 0.9,
            evidenceText: 'seed',
          },
        ],
      });
    }
  }

  it('recalculates correlations and returns dashboard data', async () => {
    const cookies = await authCookies();
    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies,
    });
    expect(me.statusCode).toBe(200);
    userId = (me.json() as { user: { id: string } }).user.id;

    await seedCorrelatedMetrics(userId);

    const recalc = await app.inject({
      method: 'POST',
      url: '/api/analytics/recalculate',
      cookies,
    });
    expect(recalc.statusCode).toBe(200);
    const recalcBody = recalc.json() as {
      correlationCount: number;
      officialCount: number;
      exploratoryCount: number;
      calculatedAt: string;
    };
    expect(recalcBody.correlationCount).toBeGreaterThan(0);
    expect(recalcBody.officialCount + recalcBody.exploratoryCount).toBe(recalcBody.correlationCount);
    expect(recalcBody.calculatedAt).toBeTruthy();

    const dashboard = await app.inject({
      method: 'GET',
      url: '/api/analytics/dashboard',
      cookies,
    });
    expect(dashboard.statusCode).toBe(200);
    const dashBody = dashboard.json() as {
      hasCorrelationResults: boolean;
      topCorrelations: unknown[];
      chartSeries: unknown[];
      insightsFeed: { hasReports: boolean; reports: unknown[] };
    };
    expect(dashBody.hasCorrelationResults).toBe(true);
    expect(dashBody.topCorrelations.length).toBeGreaterThan(0);
    expect(Array.isArray(dashBody.chartSeries)).toBe(true);
    expect(dashBody.insightsFeed.hasReports).toBe(false);
    expect(dashBody.insightsFeed.reports).toEqual([]);

    const correlations = await app.inject({
      method: 'GET',
      url: '/api/analytics/correlations?method=pearson&lagDays=0',
      cookies,
    });
    expect(correlations.statusCode).toBe(200);
    const corrBody = correlations.json() as {
      items: Array<{ id: string; correlationValue: number }>;
      heatmap: { values: Array<number | null> };
    };
    expect(corrBody.items.length).toBeGreaterThan(0);
    expect(corrBody.heatmap.metricIds.length).toBeGreaterThanOrEqual(2);
    expect(corrBody.heatmap.values.length).toBeGreaterThan(0);

    const detail = await app.inject({
      method: 'GET',
      url: `/api/analytics/correlations/${corrBody.items[0]!.id}`,
      cookies,
    });
    expect(detail.statusCode).toBe(200);
    const detailBody = detail.json() as { scatter: unknown[]; seriesA: unknown[] };
    expect(detailBody.scatter.length).toBeGreaterThanOrEqual(14);
    expect(detailBody.seriesA.length).toBeGreaterThan(0);
  });
});
