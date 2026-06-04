import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { MetricDefinition, MetricObservation } from '@prisma/client';
import { applyTelegramMetricCorrection, buildPatchBodyForTarget, buildObservedAtPatchBody } from './telegram-metric-correction.service.js';

const findEntry = vi.fn();
const listObservations = vi.fn();
const listActiveMetrics = vi.fn();
const patchObservation = vi.fn();
const persistAdd = vi.fn();
const deleteObservation = vi.fn();
const archiveMetric = vi.fn();
const reprocessEntry = vi.fn();

vi.mock('../entries/entry.repository.js', () => ({
  findDiaryEntryById: (...args: unknown[]) => findEntry(...args),
}));

vi.mock('../entries/entry.service.js', () => ({
  reprocessEntryMetricsForUser: (...args: unknown[]) => reprocessEntry(...args),
}));

vi.mock('../metrics/metric.repository.js', () => ({
  listObservationsByEntry: (...args: unknown[]) => listObservations(...args),
  listActiveMetricDefinitions: (...args: unknown[]) => listActiveMetrics(...args),
}));

vi.mock('../metrics/metrics.service.js', () => ({
  patchObservationForUser: (...args: unknown[]) => patchObservation(...args),
  deleteObservationForUser: (...args: unknown[]) => deleteObservation(...args),
  archiveMetricForUser: (...args: unknown[]) => archiveMetric(...args),
}));

vi.mock('../metrics/metric-observation-persist.js', () => ({
  persistAddObservationFromCorrection: (...args: unknown[]) => persistAdd(...args),
}));

const baseCorrectionFields = {
  apply_to: 'single' as const,
  metric_key: null,
  title: null,
  value_type: null,
  unit: null,
  scale_min: null,
  scale_max: null,
  evidence_text: null,
};

const baseDefinition = {
  id: 'def-1',
  userId: 'user-1',
  key: 'run_duration_minutes',
  title: 'Running duration',
  titleI18n: null,
  description: null,
  descriptionI18n: null,
  valueType: 'number' as const,
  unit: 'min',
  scaleMin: null,
  scaleMax: null,
  positiveDirection: 'neutral' as const,
  aliasesJson: [],
  tagsJson: [],
  tagsI18n: null,
  extractionRulesJson: null,
  createdBy: 'ai' as const,
  createdFromEntryId: null,
  confidence: 0.9,
  version: 1,
  status: 'active' as const,
  createdAt: new Date('2026-05-29T12:00:00.000Z'),
  updatedAt: new Date('2026-05-29T12:00:00.000Z'),
};

const baseObservation = {
  id: 'obs-1',
  userId: 'user-1',
  entryId: 'entry-1',
  metricDefinitionId: 'def-1',
  valueNumber: 40,
  valueText: null,
  valueBoolean: null,
  observedAt: new Date('2026-05-29T08:00:00.000Z'),
  observedAtPrecision: 'inferred' as const,
  narrativeOrder: 1,
  evidenceText: 'бегал минут 40',
  confidence: 0.9,
  metadataJson: null,
  source: 'ai' as const,
  createdAt: new Date('2026-05-29T12:00:00.000Z'),
  updatedAt: new Date('2026-05-29T12:00:00.000Z'),
  metricDefinition: baseDefinition as MetricDefinition,
} as MetricObservation & { metricDefinition: MetricDefinition };

describe('applyTelegramMetricCorrection', () => {
  beforeEach(() => {
    findEntry.mockReset();
    listObservations.mockReset();
    listActiveMetrics.mockReset();
    patchObservation.mockReset();
    persistAdd.mockReset();
    deleteObservation.mockReset();
    archiveMetric.mockReset();
    reprocessEntry.mockReset();

    findEntry.mockResolvedValue({
      id: 'entry-1',
      userId: 'user-1',
      rawText: 'Сегодня утром бегал минут 40',
      transcriptText: null,
      summaryText: null,
      entryDate: new Date('2026-05-29T00:00:00.000Z'),
      createdAt: new Date('2026-05-29T12:00:00.000Z'),
    });
    listObservations.mockResolvedValue([baseObservation]);
    listActiveMetrics.mockResolvedValue([]);
    patchObservation.mockResolvedValue({ ...baseObservation, valueNumber: 2 });
  });

  const baseInput = {
    userId: 'user-1',
    locale: 'uk' as const,
    userTimezone: 'UTC',
    entryId: 'entry-1',
  };

  it('patches observation when LLM returns fix_value', async () => {
    const chat = {
      completeStructured: vi.fn().mockResolvedValue({
        data: {
          command: 'fix_value',
          ...baseCorrectionFields,
          observation_id: 'obs-1',
          observed_at: null,
          observed_date: null,
          observed_at_precision: null,
          value_boolean: null,
          value_number: 2,
          reasoning: 'User says 2 minutes.',
        },
        model: 'gpt-4o-mini',
      }),
    };

    listObservations
      .mockResolvedValueOnce([baseObservation])
      .mockResolvedValueOnce([{ ...baseObservation, valueNumber: 2 }]);

    const result = await applyTelegramMetricCorrection(
      {
        ...baseInput,
        messageText: 'Я ошибся и на самом деле бегал 2 минуты',
      },
      { chat },
    );

    expect(result.status).toBe('applied');
    expect(patchObservation).toHaveBeenCalledWith('obs-1', 'user-1', {
      editedVia: 'telegram',
      valueNumber: 2,
    });
    expect(result.replyText).toContain('Оновлено');
  });

  it('returns unsupported when LLM cannot map to fix_value', async () => {
    const chat = {
      completeStructured: vi.fn().mockResolvedValue({
        data: {
          command: 'unsupported',
          ...baseCorrectionFields,
          observation_id: null,
          observed_at: null,
          observed_date: null,
          observed_at_precision: null,
          value_boolean: null,
          value_number: null,
          reasoning: 'User wants to delete metric.',
        },
        model: 'gpt-4o-mini',
      }),
    };

    const result = await applyTelegramMetricCorrection(
      {
        ...baseInput,
        locale: 'en',
        messageText: 'remove the rash metric',
      },
      { chat },
    );

    expect(result.status).toBe('unsupported');
    expect(patchObservation).not.toHaveBeenCalled();
  });

  it('coerces boolean LLM output into ordinal valueNumber before patch', async () => {
    const wellbeingDefinition = {
      ...baseDefinition,
      id: 'def-wellbeing',
      key: 'wellbeing',
      title: 'Добробут',
      valueType: 'ordinal' as const,
      unit: null,
      scaleMin: 1,
      scaleMax: 5,
    };
    const wellbeingObservation = {
      ...baseObservation,
      id: 'obs-wellbeing',
      metricDefinitionId: 'def-wellbeing',
      valueNumber: 2,
      metricDefinition: wellbeingDefinition,
    } as MetricObservation & { metricDefinition: MetricDefinition };

    const chat = {
      completeStructured: vi.fn().mockResolvedValue({
        data: {
          command: 'fix_value',
          ...baseCorrectionFields,
          observation_id: 'obs-wellbeing',
          observed_at: null,
          observed_date: null,
          observed_at_precision: null,
          value_boolean: true,
          value_number: null,
          reasoning: 'User felt good overall.',
        },
        model: 'gpt-4o-mini',
      }),
    };

    listObservations
      .mockResolvedValueOnce([wellbeingObservation])
      .mockResolvedValueOnce([{ ...wellbeingObservation, valueNumber: 5 }]);

    const result = await applyTelegramMetricCorrection(
      {
        ...baseInput,
        messageText: 'На самом деле я чувствовал себя хорошо, невзирая на похмелье',
      },
      { chat },
    );

    expect(result.status).toBe('applied');
    expect(patchObservation).toHaveBeenCalledWith('obs-wellbeing', 'user-1', {
      editedVia: 'telegram',
      valueNumber: 5,
    });
  });

  it('patches observed_at for all observations when LLM returns fix_observed_at', async () => {
    const secondObservation = {
      ...baseObservation,
      id: 'obs-2',
      metricDefinition: {
        ...baseDefinition,
        key: 'energy',
        title: 'Energy level',
      },
    } as MetricObservation & { metricDefinition: MetricDefinition };

    const chat = {
      completeStructured: vi.fn().mockResolvedValue({
        data: {
          command: 'fix_observed_at',
          ...baseCorrectionFields,
          apply_to: 'all_on_entry',
          observation_id: null,
          observed_at: null,
          observed_date: '2026-06-01',
          observed_at_precision: 'date_only',
          value_boolean: null,
          value_number: null,
          reasoning: 'User says events were today, not yesterday.',
        },
        model: 'gpt-4o-mini',
      }),
    };

    listObservations
      .mockResolvedValueOnce([baseObservation, secondObservation])
      .mockResolvedValueOnce([baseObservation, secondObservation]);

    const result = await applyTelegramMetricCorrection(
      {
        ...baseInput,
        messageText: 'это было сегодня, а не вчера',
      },
      { chat },
    );

    expect(result.status).toBe('applied');
    expect(patchObservation).toHaveBeenCalledTimes(2);
    expect(patchObservation).toHaveBeenCalledWith('obs-1', 'user-1', {
      editedVia: 'telegram',
      observedAt: '2026-06-01T12:00:00.000Z',
      observedAtPrecision: 'date_only',
    });
    expect(result.replyText).toContain('Оновлено дату');
  });

  it('applies date fallback when LLM returns fix_value for a date-only correction', async () => {
    const chat = {
      completeStructured: vi.fn().mockResolvedValue({
        data: {
          command: 'fix_value',
          ...baseCorrectionFields,
          observation_id: 'missing-obs',
          observed_at: null,
          observed_date: null,
          observed_at_precision: null,
          value_boolean: null,
          value_number: 2,
          reasoning: 'User corrects energy.',
        },
        model: 'gpt-4o-mini',
      }),
    };

    findEntry.mockResolvedValue({
      id: 'entry-1',
      userId: 'user-1',
      rawText: 'Вчера я встал рано утром, и позавтракал овсянкой',
      transcriptText: null,
      summaryText: null,
      entryDate: new Date('2026-06-01T00:00:00.000Z'),
      createdAt: new Date('2026-06-01T20:00:00.000Z'),
    });

    listObservations
      .mockResolvedValueOnce([baseObservation])
      .mockResolvedValueOnce([baseObservation]);

    const result = await applyTelegramMetricCorrection(
      {
        ...baseInput,
        messageText: 'А хотя нет, это было сегодня, а не вчера',
      },
      { chat },
    );

    expect(result.status).toBe('applied');
    expect(patchObservation).toHaveBeenCalledWith('obs-1', 'user-1', {
      editedVia: 'telegram',
      observedAt: '2026-06-01T12:00:00.000Z',
      observedAtPrecision: 'date_only',
    });
    expect(result.replyText).toContain('Оновлено дату');
  });

  it('adds observation when LLM returns add_observation', async () => {
    const breakfastDefinition = {
      ...baseDefinition,
      id: 'def-breakfast',
      key: 'breakfast_occurred',
      title: 'Breakfast occurred',
      valueType: 'boolean' as const,
    };
    const breakfastObservation = {
      ...baseObservation,
      id: 'obs-breakfast',
      metricDefinitionId: 'def-breakfast',
      valueNumber: null,
      valueBoolean: true,
      evidenceText: 'позавтракал омлетом',
      metricDefinition: breakfastDefinition,
    } as MetricObservation & { metricDefinition: MetricDefinition };

    const chat = {
      completeStructured: vi.fn().mockResolvedValue({
        data: {
          command: 'add_observation',
          ...baseCorrectionFields,
          metric_key: 'breakfast_occurred',
          title: 'Breakfast occurred',
          value_type: 'boolean',
          evidence_text: 'позавтракал омлетом',
          value_boolean: true,
          value_number: null,
          observed_date: '2026-06-01',
          observed_at: null,
          observed_at_precision: 'date_only',
          reasoning: 'User adds omelet breakfast.',
        },
        model: 'gpt-4o-mini',
      }),
    };

    persistAdd.mockResolvedValue({
      observation: breakfastObservation,
      created: true,
    });

    listObservations
      .mockResolvedValueOnce([baseObservation])
      .mockResolvedValueOnce([baseObservation, breakfastObservation]);

    const result = await applyTelegramMetricCorrection(
      {
        ...baseInput,
        messageText: 'на самом деле позавтракал омлетом',
      },
      { chat },
    );

    expect(result.status).toBe('applied');
    expect(persistAdd).toHaveBeenCalledOnce();
    expect(result.replyText).toContain('Додано');
  });

  it('removes observation when LLM returns remove_observation', async () => {
    const chat = {
      completeStructured: vi.fn().mockResolvedValue({
        data: {
          command: 'remove_observation',
          ...baseCorrectionFields,
          observation_id: 'obs-1',
          observed_at: null,
          observed_date: null,
          observed_at_precision: null,
          value_boolean: null,
          value_number: null,
          reasoning: 'User says this metric was wrong.',
        },
        model: 'gpt-4o-mini',
      }),
    };

    deleteObservation.mockResolvedValue({ action: 'delete' });

    listObservations
      .mockResolvedValueOnce([baseObservation])
      .mockResolvedValueOnce([]);

    const result = await applyTelegramMetricCorrection(
      {
        ...baseInput,
        messageText: 'убери эту метрику бега, этого не было',
      },
      { chat },
    );

    expect(result.status).toBe('applied');
    expect(deleteObservation).toHaveBeenCalledWith('obs-1', 'user-1', {
      editedVia: 'telegram',
    });
    expect(patchObservation).not.toHaveBeenCalled();
    expect(result.replyText).toContain('Прибрано');
  });

  it('removes last corrected metric for deictic remove even when LLM picks wrong observation', async () => {
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
    const wellbeingObservation = {
      ...baseObservation,
      id: 'obs-wellbeing',
      metricDefinitionId: 'def-wellbeing',
      valueNumber: 3,
      metricDefinition: wellbeingDefinition,
    } as MetricObservation & { metricDefinition: MetricDefinition };

    const chat = {
      completeStructured: vi.fn().mockResolvedValue({
        data: {
          command: 'remove_observation',
          ...baseCorrectionFields,
          observation_id: 'obs-wellbeing',
          observed_at: null,
          observed_date: null,
          observed_at_precision: null,
          value_boolean: null,
          value_number: null,
          reasoning: 'User asks to remove metric.',
        },
        model: 'gpt-4o-mini',
      }),
    };

    deleteObservation.mockResolvedValue({ action: 'delete' });

    listObservations
      .mockResolvedValueOnce([baseObservation, wellbeingObservation])
      .mockResolvedValueOnce([wellbeingObservation]);

    const result = await applyTelegramMetricCorrection(
      {
        ...baseInput,
        messageText: 'убери эту метрику',
        recentTurns: [
          {
            id: 'turn-ack',
            userId: 'user-1',
            chatId: BigInt(1),
            role: 'bot',
            turnType: 'correction_ack',
            text: '✓ Оновлено: Running duration — 2 min (1 Jun)',
            telegramMessageId: BigInt(10),
            replyToMessageId: BigInt(9),
            entryId: 'entry-1',
            createdAt: new Date('2026-06-01T20:56:00.000Z'),
          },
        ] as never,
      },
      { chat },
    );

    expect(result.status).toBe('applied');
    expect(deleteObservation).toHaveBeenCalledWith('obs-1', 'user-1', {
      editedVia: 'telegram',
    });
  });

  it('archives metric when LLM returns archive_metric', async () => {
    const energyDefinition = {
      ...baseDefinition,
      id: 'def-energy',
      key: 'energy',
      title: 'Energy level',
      valueType: 'ordinal' as const,
      scaleMin: 1,
      scaleMax: 5,
    };
    const energyObservation = {
      ...baseObservation,
      id: 'obs-energy',
      metricDefinitionId: 'def-energy',
      valueNumber: 4,
      metricDefinition: energyDefinition,
    } as MetricObservation & { metricDefinition: MetricDefinition };

    const chat = {
      completeStructured: vi.fn().mockResolvedValue({
        data: {
          command: 'archive_metric',
          ...baseCorrectionFields,
          metric_key: 'energy',
          observation_id: null,
          observed_at: null,
          observed_date: null,
          observed_at_precision: null,
          value_boolean: null,
          value_number: null,
          reasoning: 'User never wants to track energy again.',
        },
        model: 'gpt-4o-mini',
      }),
    };

    listObservations.mockResolvedValueOnce([energyObservation]);
    archiveMetric.mockResolvedValue({ ...energyDefinition, status: 'archived' });

    const result = await applyTelegramMetricCorrection(
      {
        ...baseInput,
        messageText: 'больше не отслеживай энергию',
      },
      { chat },
    );

    expect(result.status).toBe('applied');
    expect(archiveMetric).toHaveBeenCalledWith('def-energy', 'user-1', {
      editedVia: 'telegram',
      entryId: 'entry-1',
    });
    expect(deleteObservation).not.toHaveBeenCalled();
    expect(result.replyText).toContain('Архівовано');
  });

  it('archives metric by title in message when observation was removed', async () => {
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

    const chat = {
      completeStructured: vi.fn().mockResolvedValue({
        data: {
          command: 'archive_metric',
          ...baseCorrectionFields,
          metric_key: null,
          observation_id: 'missing-obs',
          observed_at: null,
          observed_date: null,
          observed_at_precision: null,
          value_boolean: null,
          value_number: null,
          reasoning: 'User never wants wellbeing tracked.',
        },
        model: 'gpt-4o-mini',
      }),
    };

    listObservations.mockResolvedValueOnce([]);
    listActiveMetrics.mockResolvedValue([wellbeingDefinition]);
    archiveMetric.mockResolvedValue({ ...wellbeingDefinition, status: 'archived' });

    const result = await applyTelegramMetricCorrection(
      {
        ...baseInput,
        messageText: 'Больше не отслеживай метрику Добробут',
      },
      { chat },
    );

    expect(result.status).toBe('applied');
    expect(archiveMetric).toHaveBeenCalledWith('def-wellbeing', 'user-1', {
      editedVia: 'telegram',
      entryId: 'entry-1',
    });
  });

  it('reprocesses entry when LLM returns reprocess_entry', async () => {
    const chat = {
      completeStructured: vi.fn().mockResolvedValue({
        data: {
          command: 'reprocess_entry',
          ...baseCorrectionFields,
          observation_id: null,
          observed_at: null,
          observed_date: null,
          observed_at_precision: null,
          value_boolean: null,
          value_number: null,
          reasoning: 'User asks to re-extract metrics.',
        },
        model: 'gpt-4o-mini',
      }),
    };

    reprocessEntry.mockResolvedValue({ id: 'entry-1' });

    listObservations
      .mockResolvedValueOnce([baseObservation])
      .mockResolvedValueOnce([{ ...baseObservation, valueNumber: 40 }]);

    const result = await applyTelegramMetricCorrection(
      {
        ...baseInput,
        messageText: 'перечитай запись, там два дня',
      },
      { chat },
    );

    expect(result.status).toBe('applied');
    expect(reprocessEntry).toHaveBeenCalledWith('entry-1', 'user-1', 'UTC');
    expect(result.replyText).toContain('перечитано');
    expect(result.replyText).toContain('40');
  });

  it('reprocesses entry from keyword fallback when LLM returns unsupported', async () => {
    const chat = {
      completeStructured: vi.fn().mockResolvedValue({
        data: {
          command: 'unsupported',
          ...baseCorrectionFields,
          observation_id: null,
          observed_at: null,
          observed_date: null,
          observed_at_precision: null,
          value_boolean: null,
          value_number: null,
          reasoning: 'Unclear intent.',
        },
        model: 'gpt-4o-mini',
      }),
    };

    reprocessEntry.mockResolvedValue({ id: 'entry-1' });

    listObservations
      .mockResolvedValueOnce([baseObservation])
      .mockResolvedValueOnce([baseObservation]);

    const result = await applyTelegramMetricCorrection(
      {
        ...baseInput,
        messageText:
          'Кажется, метрики не те — посмотри ещё раз, там на самом деле два дня',
      },
      { chat },
    );

    expect(result.status).toBe('applied');
    expect(reprocessEntry).toHaveBeenCalledOnce();
  });
});

describe('buildPatchBodyForTarget', () => {
  const ordinalDefinition = {
    ...baseDefinition,
    valueType: 'ordinal' as const,
    scaleMin: 1,
    scaleMax: 5,
  };

  it('maps boolean true to scale max for ordinal metrics', () => {
    const target = {
      ...baseObservation,
      metricDefinition: ordinalDefinition,
    } as MetricObservation & { metricDefinition: MetricDefinition };

    expect(
      buildPatchBodyForTarget(target, {
        value_boolean: true,
        value_number: null,
      }),
    ).toEqual({
      editedVia: 'telegram',
      valueNumber: 5,
    });
  });

  it('prefers value_number for ordinal metrics when both fields are set', () => {
    const target = {
      ...baseObservation,
      metricDefinition: ordinalDefinition,
    } as MetricObservation & { metricDefinition: MetricDefinition };

    expect(
      buildPatchBodyForTarget(target, {
        value_boolean: true,
        value_number: 4,
      }),
    ).toEqual({
      editedVia: 'telegram',
      valueNumber: 4,
    });
  });
});

describe('buildObservedAtPatchBody', () => {
  it('maps observed_date to noon UTC with date_only precision', () => {
    expect(
      buildObservedAtPatchBody({
        observed_at: null,
        observed_date: '2026-06-01',
        observed_at_precision: 'date_only',
      }),
    ).toEqual({
      editedVia: 'telegram',
      observedAt: '2026-06-01T12:00:00.000Z',
      observedAtPrecision: 'date_only',
    });
  });
});
