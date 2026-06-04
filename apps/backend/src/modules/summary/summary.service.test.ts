import { beforeEach, describe, expect, it, vi } from 'vitest';
import { summarizeEntry } from './summary.service.js';

const markSummarizing = vi.fn();
const markSuccess = vi.fn();
const markFailed = vi.fn();
const findEntry = vi.fn();
const aiRunCreate = vi.fn();

vi.mock('../entries/entry.repository.js', () => ({
  findDiaryEntryById: (...args: unknown[]) => findEntry(...args),
  markEntrySummarizing: (...args: unknown[]) => markSummarizing(...args),
  markEntrySummarySuccess: (...args: unknown[]) => markSuccess(...args),
  markEntrySummaryFailed: (...args: unknown[]) => markFailed(...args),
}));

vi.mock('../../shared/db/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'user-1', locale: 'en' }),
    },
    diaryEntry: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    profileFact: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    aiRun: {
      create: (...args: unknown[]) => aiRunCreate(...args),
    },
  },
}));

describe('summarizeEntry', () => {
  beforeEach(() => {
    markSummarizing.mockReset();
    markSuccess.mockReset();
    markFailed.mockReset();
    findEntry.mockReset();
    aiRunCreate.mockReset();
  });

  it('skips when summary already exists', async () => {
    findEntry.mockResolvedValue({
      id: 'entry-1',
      userId: 'user-1',
      sourceType: 'text',
      rawText: 'Hello',
      transcriptText: null,
      summaryText: 'Existing summary',
      entryDate: new Date('2026-05-19'),
      processingStatus: 'extracting_metrics',
    });

    const result = await summarizeEntry({
      entryId: 'entry-1',
      userId: 'user-1',
      userTimezone: 'UTC',
    });

    expect(result.skipped).toBe(true);
    expect(markSummarizing).not.toHaveBeenCalled();
  });

  it('stores summary and logs ai_run on success', async () => {
    findEntry.mockResolvedValue({
      id: 'entry-2',
      userId: 'user-1',
      sourceType: 'text',
      rawText: 'Tired morning, long meetings.',
      transcriptText: null,
      summaryText: null,
      entryDate: new Date('2026-05-19'),
      processingStatus: 'received',
    });

    const chat = {
      completeStructured: vi.fn().mockResolvedValue({
        data: { summary: 'Tired morning with long meetings.', language: 'en' },
        model: 'gpt-4o-mini',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      }),
    };

    const result = await summarizeEntry(
      { entryId: 'entry-2', userId: 'user-1', userTimezone: 'UTC' },
      { chat },
    );

    expect(result.summary).toBe('Tired morning with long meetings.');
    expect(markSummarizing).toHaveBeenCalledWith('entry-2');
    expect(markSuccess).toHaveBeenCalledWith('entry-2', 'Tired morning with long meetings.');
    expect(aiRunCreate).toHaveBeenCalledOnce();
  });
});
