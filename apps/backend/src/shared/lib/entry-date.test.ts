import { describe, expect, it } from 'vitest';
import { entryDateForTimezone, parseEntryDateFromText } from './entry-date.js';

describe('entryDateForTimezone', () => {
  it('returns YYYY-MM-DD at UTC midnight', () => {
    const date = entryDateForTimezone('UTC', new Date('2026-05-19T15:30:00Z'));
    expect(date.toISOString()).toBe('2026-05-19T00:00:00.000Z');
  });
});

describe('parseEntryDateFromText', () => {
  it('parses date from diary header', () => {
    const date = parseEntryDateFromText('День 25 (2026-03-25): Сьогодні…');
    expect(date?.toISOString()).toBe('2026-03-25T00:00:00.000Z');
  });
});

describe('entry-date-sync', () => {
  it('prefers rawText for date parse', async () => {
    const { parsedEntryDateFromEntryText, observedAtForEntryDate } = await import('./entry-date-sync.js');
    const parsed = parsedEntryDateFromEntryText(
      'День 2 (2026-03-02): текст',
      'ignored transcript',
    );
    expect(parsed?.toISOString()).toBe('2026-03-02T00:00:00.000Z');
    expect(observedAtForEntryDate(parsed!).toISOString()).toBe('2026-03-02T12:00:00.000Z');
  });
});
