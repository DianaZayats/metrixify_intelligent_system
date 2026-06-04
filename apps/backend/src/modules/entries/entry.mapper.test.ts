import { describe, expect, it } from 'vitest';
import type { DiaryEntry } from '@prisma/client';
import { entryPreviewText, toListItem } from './entry.mapper.js';

function baseEntry(overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id: 'entry-1',
    userId: 'user-1',
    sourceType: 'voice',
    rawText: null,
    transcriptText: null,
    summaryText: null,
    entryDate: new Date('2026-05-19T00:00:00.000Z'),
    processingStatus: 'transcribing',
    processingError: null,
    createdAt: new Date('2026-05-19T12:00:00.000Z'),
    updatedAt: new Date('2026-05-19T12:00:00.000Z'),
    ...overrides,
  } as DiaryEntry;
}

describe('entryPreviewText', () => {
  it('prefers summaryText over raw text', () => {
    const entry = baseEntry({
      summaryText: 'Short summary',
      rawText: 'Long raw text',
    });
    expect(entryPreviewText(entry)).toBe('Short summary');
  });

  it('prefers rawText over transcriptText', () => {
    const entry = baseEntry({ rawText: 'hello', transcriptText: 'ignored' });
    expect(entryPreviewText(entry)).toBe('hello');
  });

  it('falls back to transcriptText', () => {
    const entry = baseEntry({ transcriptText: 'voice transcript' });
    expect(entryPreviewText(entry)).toBe('voice transcript');
  });

  it('returns null while voice is transcribing', () => {
    const entry = baseEntry({ processingStatus: 'transcribing' });
    expect(entryPreviewText(entry)).toBeNull();
  });
});

describe('toListItem', () => {
  it('returns stored rawText, not summary or transcript preview', () => {
    const item = toListItem(
      baseEntry({
        rawText: 'Original user text',
        transcriptText: 'Transcript',
        summaryText: 'Summary',
      }),
    );
    expect(item.rawText).toBe('Original user text');
    expect(item.summaryText).toBe('Summary');
  });
});
