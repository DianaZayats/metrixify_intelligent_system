import { describe, expect, it } from 'vitest';
import type { MetricDefinition, MetricObservation, TelegramConversationTurn } from '@prisma/client';
import {
  findLastCorrectionEntryId,
  findLastCorrectedMetricTitle,
  isDeicticCorrectionMessage,
  resolveRemoveObservationTarget,
} from './telegram-metric-correction-dialog.js';

const baseDefinition = {
  id: 'def-run',
  userId: 'user-1',
  key: 'run_duration_minutes',
  title: 'Тривалість пробіжки (хвилин)',
  titleI18n: null,
  description: null,
  descriptionI18n: null,
  valueType: 'number' as const,
  unit: 'min',
  scaleMin: null,
  scaleMax: null,
  positiveDirection: 'neutral' as const,
  aliasesJson: ['Running duration'],
  tagsJson: [],
  tagsI18n: null,
  extractionRulesJson: null,
  createdBy: 'ai' as const,
  createdFromEntryId: null,
  confidence: 0.9,
  version: 1,
  status: 'active' as const,
  createdAt: new Date('2026-06-01T12:00:00.000Z'),
  updatedAt: new Date('2026-06-01T12:00:00.000Z'),
};

const wellbeingDefinition = {
  ...baseDefinition,
  id: 'def-wellbeing',
  key: 'wellbeing',
  title: 'Добробут',
  valueType: 'ordinal' as const,
  scaleMin: 1,
  scaleMax: 5,
  unit: null,
};

function observation(
  id: string,
  definition: MetricDefinition,
): MetricObservation & { metricDefinition: MetricDefinition } {
  return {
    id,
    userId: 'user-1',
    entryId: 'entry-1',
    metricDefinitionId: definition.id,
    valueNumber: definition.valueType === 'number' ? 2 : 3,
    valueText: null,
    valueBoolean: null,
    observedAt: new Date('2026-06-01T08:00:00.000Z'),
    observedAtPrecision: 'date_only' as const,
    narrativeOrder: 1,
    evidenceText: 'test',
    confidence: 0.9,
    metadataJson: null,
    source: 'ai' as const,
    createdAt: new Date('2026-06-01T12:00:00.000Z'),
    updatedAt: new Date('2026-06-01T12:00:00.000Z'),
    metricDefinition: definition,
  };
}

describe('telegram-metric-correction-dialog', () => {
  it('detects deictic remove requests', () => {
    expect(isDeicticCorrectionMessage('убери эту метрику')).toBe(true);
    expect(isDeicticCorrectionMessage('remove this metric')).toBe(true);
  });

  it('uses last correction ack metric for deictic remove', () => {
    const recentTurns = [
      {
        id: 'turn-1',
        userId: 'user-1',
        chatId: BigInt(1),
        role: 'bot',
        turnType: 'correction_ack',
        text: '✓ Оновлено: Тривалість пробіжки (хвилин) — 2 min (1 черв.)',
        telegramMessageId: BigInt(10),
        replyToMessageId: BigInt(9),
        entryId: 'entry-1',
        createdAt: new Date('2026-06-01T20:56:00.000Z'),
      },
    ] as TelegramConversationTurn[];

    const observations = [
      observation('obs-run', baseDefinition),
      observation('obs-wellbeing', wellbeingDefinition),
    ];

    const target = resolveRemoveObservationTarget(
      'убери эту метрику',
      'obs-wellbeing',
      observations,
      recentTurns,
      'entry-1',
    );

    expect(target?.id).toBe('obs-run');
  });

  it('finds last correction entry id from recent turns', () => {
    const recentTurns = [
      {
        id: 'turn-1',
        userId: 'user-1',
        chatId: BigInt(1),
        role: 'user',
        turnType: 'correction_user',
        text: 'на самом деле 2 минуты',
        telegramMessageId: BigInt(9),
        replyToMessageId: null,
        entryId: 'entry-run',
        createdAt: new Date('2026-06-01T20:56:00.000Z'),
      },
    ] as TelegramConversationTurn[];

    expect(findLastCorrectionEntryId(recentTurns, new Set(['entry-run', 'entry-old']))).toBe(
      'entry-run',
    );
  });

  it('parses metric title from correction ack', () => {
    expect(
      findLastCorrectedMetricTitle(
        [
          {
            id: 'turn-1',
            userId: 'user-1',
            chatId: BigInt(1),
            role: 'bot',
            turnType: 'correction_ack',
            text: '✓ Оновлено: Тривалість пробіжки (хвилин) — 2 min (1 черв.)',
            telegramMessageId: BigInt(10),
            replyToMessageId: BigInt(9),
            entryId: 'entry-1',
            createdAt: new Date('2026-06-01T20:56:00.000Z'),
          },
        ] as TelegramConversationTurn[],
        'entry-1',
      ),
    ).toBe('Тривалість пробіжки (хвилин)');
  });
});
