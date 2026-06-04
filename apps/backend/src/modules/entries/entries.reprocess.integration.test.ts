import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getInternalApiKey, resetConfigCache } from '@metrixify/config';
import { buildApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { SESSION_COOKIE_NAME } from '../auth/auth.constants.js';
import {
  createMetricDefinitionFromCandidate,
  createMetricObservation,
  findMetricDefinitionByKey,
  resolveMetricKey,
} from '../metrics/metric.repository.js';

vi.mock('../summary/summary.service.js', () => ({
  maybeSummarizeEntry: vi.fn(async () => false),
}));

vi.mock('../metrics/metric-extraction.service.js', () => ({
  maybeExtractMetrics: vi.fn(
    async (entry: { id: string; userId: string; entryDate: Date }) => {
      const candidate = {
        candidate_key: 'energy',
        title: 'Energy',
        value_type: 'ordinal' as const,
        value_number: 4,
        value_text: null,
        value_boolean: null,
        unit: null,
        scale_min: 1,
        scale_max: 5,
        evidence_text: 'reprocess test',
        confidence: 0.9,
        reasoning: null,
        observed_date: null,
        tags: ['mood'],
      };
      const key = resolveMetricKey(candidate);
      const definition =
        (await findMetricDefinitionByKey(entry.userId, key)) ??
        (await createMetricDefinitionFromCandidate({
          userId: entry.userId,
          entryId: entry.id,
          key,
          candidate,
        }));
      await createMetricObservation({
        userId: entry.userId,
        entryId: entry.id,
        metricDefinitionId: definition.id,
        observedAt: entry.entryDate,
        valueNumber: 4,
        valueText: null,
        valueBoolean: null,
        confidence: 0.9,
        evidenceText: 'reprocess test',
      });
      await prisma.diaryEntry.update({
        where: { id: entry.id },
        data: { processingStatus: 'resolving_schema', processingError: null },
      });
      return true;
    },
  ),
}));

vi.mock('../metrics/metric-schema-resolver.service.js', () => ({
  maybeResolveSchema: vi.fn(async (entry: { id: string }) => {
    await prisma.diaryEntry.update({
      where: { id: entry.id },
      data: { processingStatus: 'extracting_facts' },
    });
    return true;
  }),
}));

const extractProfileFacts = vi.fn(async () => true);

vi.mock('../profile-facts/profile-fact-extraction.service.js', () => ({
  maybeExtractProfileFacts: (...args: unknown[]) => extractProfileFacts(...args),
}));

const hasDatabase = Boolean(process.env.DATABASE_URL);
const telegramUserId = 9_003_012;

describe.skipIf(!hasDatabase)('entry metrics reprocess API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let entryId: string;
  let userId: string;
  const internalKey = process.env.SESSION_SECRET ?? 'test-secret-key-32chars-minimum!!';

  beforeAll(async () => {
    process.env.SESSION_SECRET = internalKey;
    resetConfigCache();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    if (entryId) {
      await prisma.aiRun.deleteMany({ where: { entryId } });
      await prisma.metricObservation.deleteMany({ where: { entryId } });
      await prisma.metricDefinition.deleteMany({ where: { createdFromEntryId: entryId } });
      await prisma.diaryEntry.delete({ where: { id: entryId } }).catch(() => undefined);
    }
    if (userId) {
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

  it('reprocesses metrics only and keeps summary unchanged', async () => {
    const ingest = await app.inject({
      method: 'POST',
      url: '/api/internal/telegram/message',
      headers: { 'x-metrixify-internal-key': getInternalApiKey() },
      payload: {
        updateId: 9_003_012_001,
        messageId: 1,
        chatId: telegramUserId,
        chatType: 'private',
        telegramUserId,
        text: 'Reprocess integration entry',
      },
    });
    expect(ingest.statusCode).toBe(200);
    entryId = ingest.json().entryId as string;

    await prisma.diaryEntry.update({
      where: { id: entryId },
      data: {
        summaryText: 'Original summary',
        processingStatus: 'completed',
      },
    });
    await prisma.aiRun.create({
      data: {
        userId: (await prisma.diaryEntry.findUnique({ where: { id: entryId } }))!.userId,
        entryId,
        runType: 'fact_extraction',
        model: 'test',
        promptVersion: 'test',
        inputFormat: 'json',
        inputSnapshot: {},
        outputSnapshot: {},
        validationStatus: 'valid',
      },
    });

    userId = (await prisma.diaryEntry.findUnique({ where: { id: entryId } }))!.userId;
    const cookies = await authCookies();

    const response = await app.inject({
      method: 'POST',
      url: `/api/entries/${entryId}/reprocess`,
      cookies,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { summaryText: string; processingStatus: string; observations: unknown[] };
    expect(body.summaryText).toBe('Original summary');
    expect(body.processingStatus).toBe('completed');
    expect(body.observations.length).toBeGreaterThan(0);

    const factRuns = await prisma.aiRun.count({
      where: { entryId, runType: 'fact_extraction' },
    });
    expect(factRuns).toBe(1);
    expect(extractProfileFacts).toHaveBeenCalledTimes(1);
  });
});
