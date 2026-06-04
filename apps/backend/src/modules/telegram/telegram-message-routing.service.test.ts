import { describe, expect, it, vi } from 'vitest';
import {
  classifyTelegramMessageWithAi,
  resolveCorrectionTargetEntryId,
} from './telegram-message-routing.service.js';
import type { RecentEntryRoutingContext } from './telegram-message-routing-context.js';

const recentEntries: RecentEntryRoutingContext[] = [
  {
    id: 'entry-1',
    entryDate: '2026-05-29',
    rawTextPreview: 'Сегодня утром бегал минут 40',
    summaryMessageId: 100,
    inboundMessageId: 50,
    metricTitles: ['Running duration'],
    processingStatus: 'completed',
  },
];

describe('classifyTelegramMessageWithAi', () => {
  it('returns diary_entry when LLM classifies a new log', async () => {
    const chat = {
      completeStructured: vi.fn().mockResolvedValue({
        data: {
          intent: 'diary_entry',
          target_entry_id: null,
          reasoning: 'New hangover symptom today.',
        },
        model: 'gpt-4o-mini',
      }),
    };

    const result = await classifyTelegramMessageWithAi(
      {
        text: 'Сегодня у меня бадун после вчерашнего',
        recentTurns: [],
        recentEntries,
      },
      { chat },
    );

    expect(result.kind).toBe('diary_entry');
    expect(chat.completeStructured).toHaveBeenCalledOnce();
  });

  it('returns correction with validated entry id from LLM', async () => {
    const chat = {
      completeStructured: vi.fn().mockResolvedValue({
        data: {
          intent: 'correction',
          target_entry_id: 'entry-1',
          reasoning: 'User corrects run duration on existing entry.',
        },
        model: 'gpt-4o-mini',
      }),
    };

    const result = await classifyTelegramMessageWithAi(
      {
        text: 'Я ошибся и на самом деле бегал 2 минуты',
        replyToMessageId: 50,
        replyEntryId: 'entry-1',
        recentTurns: [],
        recentEntries,
      },
      { chat },
    );

    expect(result.kind).toBe('correction');
    expect(result.entryId).toBe('entry-1');
  });

  it('falls back to diary_entry when LLM call fails', async () => {
    const chat = {
      completeStructured: vi.fn().mockRejectedValue(new Error('API down')),
    };

    const result = await classifyTelegramMessageWithAi(
      {
        text: 'Сегодня у меня бадун',
        recentTurns: [],
        recentEntries,
      },
      { chat },
    );

    expect(result.kind).toBe('diary_entry');
  });
});

describe('resolveCorrectionTargetEntryId', () => {
  const oatmealEntry: RecentEntryRoutingContext = {
    id: 'entry-oatmeal',
    entryDate: '2026-06-01',
    rawTextPreview: 'Вчера я встал рано утром, и позавтракал овсянкой',
    summaryMessageId: 200,
    inboundMessageId: 150,
    metricTitles: ['Wellbeing', 'Energy level'],
    processingStatus: 'completed',
  };
  const hangoverEntry: RecentEntryRoutingContext = {
    id: 'entry-hangover',
    entryDate: '2026-06-01',
    rawTextPreview: 'Сегодня у меня бадун после вчерашнего',
    summaryMessageId: 100,
    inboundMessageId: 50,
    metricTitles: ['Energy level'],
    processingStatus: 'completed',
  };
  const recentEntries = [oatmealEntry, hangoverEntry];

  it('prefers entry whose preview overlaps correction facts over LLM wrong pick', () => {
    const entryId = resolveCorrectionTargetEntryId(
      'А хотя нет, я встал днём и позавтракал омлетом и это было сегодня, а не вчера',
      'entry-hangover',
      null,
      [],
      recentEntries,
    );

    expect(entryId).toBe('entry-oatmeal');
  });

  it('uses reply target before overlap scoring', () => {
    const entryId = resolveCorrectionTargetEntryId(
      'исправь энергию',
      'entry-oatmeal',
      'entry-hangover',
      [],
      recentEntries,
    );

    expect(entryId).toBe('entry-hangover');
  });

  it('prefers last correction entry for deictic remove over wrong LLM pick', () => {
    const runEntry: RecentEntryRoutingContext = {
      id: 'entry-run',
      entryDate: '2026-06-01',
      rawTextPreview: 'Сегодня бегал 40 минут',
      summaryMessageId: 300,
      inboundMessageId: 250,
      metricTitles: ['Тривалість пробіжки (хвилин)'],
      processingStatus: 'completed',
    };

    const entryId = resolveCorrectionTargetEntryId(
      'убери эту метрику',
      'entry-hangover',
      null,
      [
        {
          id: 'turn-1',
          userId: 'user-1',
          chatId: BigInt(1),
          role: 'user',
          turnType: 'correction_user',
          text: 'на самом деле 2 минуты',
          telegramMessageId: BigInt(251),
          replyToMessageId: null,
          entryId: 'entry-run',
          createdAt: new Date('2026-06-01T20:56:00.000Z'),
        },
      ] as never,
      [runEntry, hangoverEntry],
    );

    expect(entryId).toBe('entry-run');
  });
});
