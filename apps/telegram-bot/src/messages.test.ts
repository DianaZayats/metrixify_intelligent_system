import { describe, expect, it } from 'vitest';
import { getMessages } from './messages/index.js';

describe('formatEntrySavedSummary', () => {
  it('formats HTML bullet list with metrics', () => {
    const { formatEntrySavedSummary } = getMessages('en');
    const text = formatEntrySavedSummary({
      processingStatus: 'completed',
      journalUrl: 'http://localhost:5173/journal',
      observations: [
        {
          metricTitle: 'Nuts',
          valueDisplay: 'yes',
          observedAt: '2026-05-29T12:00:00.000Z',
        },
      ],
    });
    expect(text).toContain('<b>✓ Entry saved</b>');
    expect(text).toContain('<b>Metrics</b>');
    expect(text).toContain('<b>Nuts</b> — yes');
    expect(text).not.toContain('Open journal:');
  });

  it('adds partial note when pipeline incomplete', () => {
    const { formatEntrySavedSummary } = getMessages('uk');
    const text = formatEntrySavedSummary({
      processingStatus: 'extracting_facts',
      journalUrl: 'http://localhost:5173/journal',
      observations: [],
    });
    expect(text).toContain('<b>✓ Запис збережено</b>');
    expect(text).toContain('метрик не знайдено');
    expect(text).toContain('Обробка не завершилась');
  });
});

describe('formatStatusList', () => {
  it('formats entries for /status reply with status emoji', () => {
    const { formatStatusList } = getMessages('en');
    const text = formatStatusList([
      {
        entryDate: '2026-05-19',
        processingStatus: 'received',
        rawText: 'Hello world from telegram',
      },
    ]);
    expect(text).toContain('2026-05-19');
    expect(text).toContain('received');
    expect(text).toContain('Hello world');
    expect(text).toContain('⏳');
  });
});

describe('formatLoginLink', () => {
  it('does not embed raw URL for public hosts', () => {
    const { formatLoginLink } = getMessages('en');
    const text = formatLoginLink('https://app.example.com/auth/telegram-token?token=secret');
    expect(text).not.toContain('https://app.example.com');
    expect(text).toContain('<b>Sign in to Metrixify</b>');
  });

  it('embeds localhost URL for local dev copy-paste', () => {
    const { formatLoginLink } = getMessages('uk');
    const url = 'http://localhost:5173/auth/telegram-token?token=abc123';
    const text = formatLoginLink(url);
    expect(text).toContain('localhost:5173');
    expect(text).toContain('abc123');
  });
});

describe('getMessages', () => {
  it('falls back to English for unknown locale handling', () => {
    const messages = getMessages('en');
    expect(messages.MSG_START).toContain('Welcome to Metrixify');
  });

  it('returns Ukrainian messages', () => {
    const messages = getMessages('uk');
    expect(messages.MSG_START).toContain('Ласкаво просимо');
  });

  it('includes processing acknowledgement copy', () => {
    expect(getMessages('en').MSG_ENTRY_PROCESSING).toContain('Processing your entry');
    expect(getMessages('uk').MSG_ENTRY_PROCESSING).toContain('Обробляю запис');
  });
});
