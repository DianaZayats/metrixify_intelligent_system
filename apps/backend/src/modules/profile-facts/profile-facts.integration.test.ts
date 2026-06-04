import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getInternalApiKey, resetConfigCache } from '@metrixify/config';
import {
  markEntryExtractionSuccess,
  markEntrySchemaResolveSuccess,
  markEntrySummarySuccess,
} from '../entries/entry.repository.js';
import { buildApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

vi.mock('../summary/summary.service.js', () => ({
  maybeSummarizeEntry: vi.fn(async (entry: { id: string }) => {
    await markEntrySummarySuccess(entry.id, 'Summary for profile facts test');
    return true;
  }),
}));

vi.mock('../metrics/metric-extraction.service.js', () => ({
  maybeExtractMetrics: vi.fn(async (entry: { id: string }) => {
    await markEntryExtractionSuccess(entry.id);
    return true;
  }),
}));

vi.mock('../metrics/metric-schema-resolver.service.js', () => ({
  maybeResolveSchema: vi.fn(async (entry: { id: string }) => {
    await markEntrySchemaResolveSuccess(entry.id);
    return true;
  }),
}));

const mockCompleteStructured = vi.fn(async () => ({
  model: 'gpt-4o-mini',
  data: {
    facts: [
      {
        key: 'job_title',
        value_text: 'Works as a software developer',
        fact_type: 'work',
        stability: 'stable',
        evidence_text: 'работаю разработчиком',
        confidence: 0.92,
        reasoning: 'Explicit job statement',
        operation: 'create_fact',
      },
    ],
  },
  usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
}));

vi.mock('../profile-facts/profile-fact-extraction.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../profile-facts/profile-fact-extraction.service.js')>();
  return {
    maybeExtractProfileFacts: vi.fn(async (entry: { id: string }, userId: string, userTimezone: string) => {
      await actual.extractProfileFactsForEntry(
        { entryId: entry.id, userId, userTimezone },
        { chat: { completeStructured: mockCompleteStructured } },
      );
      return true;
    }),
  };
});

describe.skipIf(!hasDatabase)('profile facts integration', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const internalKey = process.env.SESSION_SECRET ?? 'test-secret-key-32chars-minimum!!';
  const updateId = 9_008_001;

  beforeAll(async () => {
    process.env.SESSION_SECRET = internalKey;
    resetConfigCache();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    const source = await prisma.entrySource.findUnique({
      where: { idempotencyKey: `telegram:${updateId}` },
    });
    if (source) {
      const facts = await prisma.profileFact.findMany({ where: { lastSeenEntryId: source.entryId } });
      for (const fact of facts) {
        await prisma.profileFactEvidence.deleteMany({ where: { profileFactId: fact.id } });
        await prisma.profileFact.delete({ where: { id: fact.id } });
      }
      await prisma.aiRun.deleteMany({ where: { entryId: source.entryId } });
      await prisma.entrySource.delete({ where: { id: source.id } });
      await prisma.diaryEntry.delete({ where: { id: source.entryId } }).catch(() => undefined);
    }
    await app.close();
    await prisma.$disconnect();
  });

  it('extracts profile facts and completes pipeline', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/internal/telegram/message',
      headers: { 'x-metrixify-internal-key': getInternalApiKey() },
      payload: {
        updateId,
        messageId: 801,
        chatId: 100,
        chatType: 'private',
        telegramUserId: 9_008_002,
        text: 'Я работаю разработчиком и вечерами работаю над pet-проектом.',
      },
    });

    expect(response.statusCode).toBe(200);
    const entryId = response.json().entryId as string;

    const entry = await prisma.diaryEntry.findUnique({ where: { id: entryId } });
    expect(entry?.processingStatus).toBe('completed');

    const facts = await prisma.profileFact.findMany({
      where: { key: 'job_title' },
      include: { evidence: true },
    });
    expect(facts.length).toBeGreaterThanOrEqual(1);
    expect(facts[0]?.evidence.length).toBeGreaterThanOrEqual(1);

    const run = await prisma.aiRun.findFirst({
      where: { entryId, runType: 'fact_extraction', validationStatus: 'valid' },
    });
    expect(run).not.toBeNull();
  });
});
