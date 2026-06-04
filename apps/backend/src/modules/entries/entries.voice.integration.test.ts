import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getInternalApiKey, resetConfigCache } from '@metrixify/config';
import { markEntryTranscriptionSuccess } from './entry.repository.js';

vi.mock('../transcription/transcription.service.js', () => ({
  transcribeVoiceEntry: vi.fn(async (input: { entryId: string }) => {
    await markEntryTranscriptionSuccess(input.entryId, 'Integration voice transcript');
    return { transcript: 'Integration voice transcript' };
  }),
}));

vi.mock('../summary/summary.service.js', () => ({
  maybeSummarizeEntry: vi.fn().mockResolvedValue(false),
}));

vi.mock('../metrics/metric-extraction.service.js', () => ({
  maybeExtractMetrics: vi.fn().mockResolvedValue(false),
}));

import { buildApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)('telegram voice ingest API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const internalKey = process.env.SESSION_SECRET ?? 'test-secret-key-32chars-minimum!!';
  const updateId = 9_001_101;

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

  it('ingests voice message with mocked transcription', async () => {
    const payload = {
      updateId,
      messageId: 2,
      chatId: 100,
      chatType: 'private',
      telegramUserId: 9_001_102,
      fileId: 'voice-file-id',
      duration: 8,
    };

    const first = await app.inject({
      method: 'POST',
      url: '/api/internal/telegram/voice',
      headers: { 'x-metrixify-internal-key': getInternalApiKey() },
      payload,
    });

    expect(first.statusCode).toBe(200);
    const firstBody = first.json();
    expect(firstBody.created).toBe(true);
    expect(firstBody.transcribed).toBe(true);

    const entry = await prisma.diaryEntry.findUnique({ where: { id: firstBody.entryId } });
    expect(entry?.sourceType).toBe('voice');
    expect(entry?.transcriptText).toBe('Integration voice transcript');
    expect(entry?.processingStatus).toBe('transcribed');

    const second = await app.inject({
      method: 'POST',
      url: '/api/internal/telegram/voice',
      headers: { 'x-metrixify-internal-key': getInternalApiKey() },
      payload,
    });

    expect(second.statusCode).toBe(200);
    const secondBody = second.json();
    expect(secondBody.created).toBe(false);
    expect(secondBody.entryId).toBe(firstBody.entryId);
    expect(secondBody.transcribed).toBe(true);
  });
});
