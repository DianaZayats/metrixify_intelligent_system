import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getInternalApiKey, resetConfigCache } from '@metrixify/config';
import { markEntrySummarySuccess } from '../entries/entry.repository.js';

vi.mock('../summary/summary.service.js', () => ({
  maybeSummarizeEntry: vi.fn(async (entry: { id: string }) => {
    await markEntrySummarySuccess(entry.id, 'Integration summary text');
    return true;
  }),
}));

vi.mock('../metrics/metric-extraction.service.js', () => ({
  maybeExtractMetrics: vi.fn().mockResolvedValue(false),
}));

import { buildApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)('telegram text ingest with summary', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const internalKey = process.env.SESSION_SECRET ?? 'test-secret-key-32chars-minimum!!';
  const updateId = 9_001_201;

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
      await prisma.aiRun.deleteMany({ where: { entryId: source.entryId } });
      await prisma.entrySource.delete({ where: { id: source.id } });
      await prisma.diaryEntry.delete({ where: { id: source.entryId } }).catch(() => undefined);
    }
    await app.close();
    await prisma.$disconnect();
  });

  it('ingests text and stores summary via mocked summarizer', async () => {
    const payload = {
      updateId,
      messageId: 3,
      chatId: 100,
      chatType: 'private',
      telegramUserId: 9_001_202,
      text: 'Integration test entry for summary stage',
    };

    const response = await app.inject({
      method: 'POST',
      url: '/api/internal/telegram/message',
      headers: { 'x-metrixify-internal-key': getInternalApiKey() },
      payload,
    });

    expect(response.statusCode).toBe(200);

    const entry = await prisma.diaryEntry.findUnique({
      where: { id: response.json().entryId },
    });
    expect(entry?.summaryText).toBe('Integration summary text');
    expect(entry?.processingStatus).toBe('extracting_metrics');
  });
});
