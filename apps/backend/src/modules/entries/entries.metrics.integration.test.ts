import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getInternalApiKey, resetConfigCache } from '@metrixify/config';
import { markEntrySummarySuccess } from '../entries/entry.repository.js';
import {
  createMetricDefinitionFromCandidate,
  createMetricObservation,
  resolveMetricKey,
} from '../metrics/metric.repository.js';

vi.mock('../summary/summary.service.js', () => ({
  maybeSummarizeEntry: vi.fn(async (entry: { id: string }) => {
    await markEntrySummarySuccess(entry.id, 'Integration summary for metrics');
    return true;
  }),
}));

vi.mock('../metrics/metric-extraction.service.js', () => ({
  maybeExtractMetrics: vi.fn(
    async (entry: { id: string; userId: string; entryDate: Date }) => {
      const candidate = {
        candidate_key: 'wellbeing',
        title: 'Wellbeing',
        value_type: 'ordinal' as const,
        value_number: 3,
        value_text: null,
        value_boolean: null,
        unit: null,
        scale_min: 1,
        scale_max: 5,
        evidence_text: 'integration test',
        confidence: 0.9,
        reasoning: null,
        observed_date: null,
        tags: ['mood'],
      };
      const definition = await createMetricDefinitionFromCandidate({
        userId: entry.userId,
        entryId: entry.id,
        key: resolveMetricKey(candidate),
        candidate,
      });
      await createMetricObservation({
        userId: entry.userId,
        entryId: entry.id,
        metricDefinitionId: definition.id,
        observedAt: entry.entryDate,
        valueNumber: 3,
        valueText: null,
        valueBoolean: null,
        confidence: 0.9,
        evidenceText: 'integration test',
      });
      return true;
    },
  ),
}));

import { buildApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)('telegram text ingest with metric extraction', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const internalKey = process.env.SESSION_SECRET ?? 'test-secret-key-32chars-minimum!!';
  const updateId = 9_001_301;

  beforeAll(async () => {
    process.env.SESSION_SECRET = internalKey;
    resetConfigCache();
    const ok = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    if (!ok) {
      throw new Error('Database is not reachable');
    }
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    const source = await prisma.entrySource.findUnique({
      where: { idempotencyKey: `telegram:${updateId}` },
    });
    if (source) {
      await prisma.metricObservation.deleteMany({ where: { entryId: source.entryId } });
      await prisma.metricDefinition.deleteMany({ where: { createdFromEntryId: source.entryId } });
      await prisma.entrySource.delete({ where: { id: source.id } });
      await prisma.diaryEntry.delete({ where: { id: source.entryId } }).catch(() => undefined);
    }
    await app.close();
    await prisma.$disconnect();
  });

  it('runs pipeline and stores observations via mocked extractor', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/internal/telegram/message',
      headers: { 'x-metrixify-internal-key': getInternalApiKey() },
      payload: {
        updateId,
        messageId: 4,
        chatId: 100,
        chatType: 'private',
        telegramUserId: 9_001_302,
        text: 'Felt tired today, mood is low.',
      },
    });

    expect(response.statusCode).toBe(200);
    const entryId = response.json().entryId as string;
    const observations = await prisma.metricObservation.findMany({ where: { entryId } });
    expect(observations.length).toBe(1);
  });
});
