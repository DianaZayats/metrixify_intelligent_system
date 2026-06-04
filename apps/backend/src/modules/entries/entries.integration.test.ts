import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getInternalApiKey, resetConfigCache } from '@metrixify/config';
import { buildApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';

vi.mock('../summary/summary.service.js', () => ({
  maybeSummarizeEntry: vi.fn().mockResolvedValue(false),
}));

vi.mock('../metrics/metric-extraction.service.js', () => ({
  maybeExtractMetrics: vi.fn().mockResolvedValue(false),
}));

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)('entries API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const internalKey = process.env.SESSION_SECRET ?? 'test-secret-key-32chars-minimum!!';
  const updateId = 9_001_001;

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
      await prisma.entrySource.delete({ where: { id: source.id } });
      await prisma.diaryEntry.delete({ where: { id: source.entryId } }).catch(() => undefined);
    }
    await app.close();
    await prisma.$disconnect();
  });

  it('ingests telegram message with idempotency', async () => {
    const payload = {
      updateId,
      messageId: 1,
      chatId: 100,
      chatType: 'private',
      telegramUserId: 9_001_002,
      text: 'Integration test entry from vitest',
    };

    const first = await app.inject({
      method: 'POST',
      url: '/api/internal/telegram/message',
      headers: { 'x-metrixify-internal-key': getInternalApiKey() },
      payload,
    });

    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody.created).toBe(true);

    const second = await app.inject({
      method: 'POST',
      url: '/api/internal/telegram/message',
      headers: { 'x-metrixify-internal-key': getInternalApiKey() },
      payload,
    });

    expect(second.statusCode).toBe(200);
    const secondBody = second.json();
    expect(secondBody.created).toBe(false);
    expect(secondBody.entryId).toBe(firstBody.entryId);
  });

  it('requires session for entries list', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/entries?limit=5' });
    expect(response.statusCode).toBe(401);
  });
});
