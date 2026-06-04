import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { DiaryEntry, MetricDefinition, MetricObservation } from '@prisma/client';
import {
  correctionOutputToCandidate,
  persistAddObservationFromCorrection,
} from './metric-observation-persist.js';

const findDefinition = vi.fn();
const ensureDefinition = vi.fn();
const createObservation = vi.fn();
const patchObservation = vi.fn();

vi.mock('./metric.repository.js', () => ({
  findMetricDefinitionByKeyAnyStatus: (...args: unknown[]) => findDefinition(...args),
  ensureMetricDefinitionForCandidate: (...args: unknown[]) => ensureDefinition(...args),
  createMetricObservation: (...args: unknown[]) => createObservation(...args),
  resolveMetricKey: (candidate: { candidate_key: string }) =>
    candidate.candidate_key.trim().toLowerCase(),
}));

vi.mock('./metrics.service.js', () => ({
  patchObservationForUser: (...args: unknown[]) => patchObservation(...args),
}));

const baseDefinition = {
  id: 'def-breakfast',
  userId: 'user-1',
  key: 'breakfast_occurred',
  title: 'Breakfast occurred',
  titleI18n: null,
  description: null,
  descriptionI18n: null,
  valueType: 'boolean' as const,
  unit: null,
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
  createdAt: new Date('2026-06-01T12:00:00.000Z'),
  updatedAt: new Date('2026-06-01T12:00:00.000Z'),
} as MetricDefinition;

const entry = {
  id: 'entry-1',
  userId: 'user-1',
  rawText: 'Вчера я встал рано утром, и позавтракал овсянкой',
  transcriptText: null,
  summaryText: null,
  entryDate: new Date('2026-06-01T00:00:00.000Z'),
  createdAt: new Date('2026-06-01T20:00:00.000Z'),
} as DiaryEntry;

describe('metric-observation-persist', () => {
  beforeEach(() => {
    findDefinition.mockReset();
    ensureDefinition.mockReset();
    createObservation.mockReset();
    patchObservation.mockReset();

    findDefinition.mockResolvedValue(null);
    ensureDefinition.mockResolvedValue(baseDefinition);
    createObservation.mockResolvedValue({
      id: 'obs-new',
      userId: 'user-1',
      entryId: 'entry-1',
      metricDefinitionId: 'def-breakfast',
      valueNumber: null,
      valueText: null,
      valueBoolean: true,
      observedAt: new Date('2026-06-01T12:00:00.000Z'),
      evidenceText: 'позавтракал омлетом',
      confidence: 0.85,
      metadataJson: null,
      source: 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  it('maps add_observation output to candidate', () => {
    const candidate = correctionOutputToCandidate({
      command: 'add_observation',
      apply_to: 'single',
      observation_id: null,
      metric_key: 'breakfast_occurred',
      title: 'Breakfast occurred',
      value_type: 'boolean',
      unit: null,
      scale_min: null,
      scale_max: null,
      evidence_text: 'позавтракал омлетом',
      value_boolean: true,
      value_number: null,
      observed_date: '2026-06-01',
      observed_at: null,
      observed_at_precision: 'date_only',
      reasoning: 'Add omelet breakfast.',
    });

    expect(candidate?.candidate_key).toBe('breakfast_occurred');
    expect(candidate?.value_boolean).toBe(true);
  });

  it('creates observation when metric is grounded and missing on entry', async () => {
    const result = await persistAddObservationFromCorrection(
      {
        userId: 'user-1',
        entry,
        entryText: entry.rawText!,
        correctionMessage: 'на самом деле позавтракал омлетом',
        userTimezone: 'UTC',
        output: {
          command: 'add_observation',
          apply_to: 'single',
          observation_id: null,
          metric_key: 'breakfast_occurred',
          title: 'Breakfast occurred',
          value_type: 'boolean',
          unit: null,
          scale_min: null,
          scale_max: null,
          evidence_text: 'позавтракал омлетом',
          value_boolean: true,
          value_number: null,
          observed_date: '2026-06-01',
          observed_at: null,
          observed_at_precision: 'date_only',
          reasoning: 'Add omelet breakfast.',
        },
      },
      [],
    );

    expect(result.created).toBe(true);
    expect(createObservation).toHaveBeenCalledOnce();
    expect(ensureDefinition).toHaveBeenCalledOnce();
  });

  it('patches existing observation on entry instead of creating duplicate', async () => {
    const existing = {
      id: 'obs-existing',
      userId: 'user-1',
      entryId: 'entry-1',
      metricDefinitionId: 'def-breakfast',
      valueNumber: null,
      valueText: null,
      valueBoolean: false,
      observedAt: new Date('2026-05-31T12:00:00.000Z'),
      evidenceText: 'позавтракал овсянкой',
      confidence: 0.8,
      metadataJson: null,
      source: 'ai' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      metricDefinition: baseDefinition,
    } as MetricObservation & { metricDefinition: MetricDefinition };

    findDefinition.mockResolvedValue(baseDefinition);
    patchObservation.mockResolvedValue({
      ...existing,
      valueBoolean: true,
      metricDefinition: baseDefinition,
    });

    const result = await persistAddObservationFromCorrection(
      {
        userId: 'user-1',
        entry,
        entryText: entry.rawText!,
        correctionMessage: 'позавтракал омлетом',
        userTimezone: 'UTC',
        output: {
          command: 'add_observation',
          apply_to: 'single',
          observation_id: null,
          metric_key: 'breakfast_occurred',
          title: 'Breakfast occurred',
          value_type: 'boolean',
          unit: null,
          scale_min: null,
          scale_max: null,
          evidence_text: 'позавтракал омлетом',
          value_boolean: true,
          value_number: null,
          observed_date: '2026-06-01',
          observed_at: null,
          observed_at_precision: 'date_only',
          reasoning: 'Correct breakfast to omelet.',
        },
      },
      [existing],
    );

    expect(result.created).toBe(false);
    expect(patchObservation).toHaveBeenCalledWith('obs-existing', 'user-1', {
      editedVia: 'telegram',
      valueBoolean: true,
    });
    expect(createObservation).not.toHaveBeenCalled();
  });

  it('rejects ungrounded evidence', async () => {
    await expect(
      persistAddObservationFromCorrection(
        {
          userId: 'user-1',
          entry,
          entryText: entry.rawText!,
          correctionMessage: 'nothing relevant',
          userTimezone: 'UTC',
          output: {
            command: 'add_observation',
            apply_to: 'single',
            observation_id: null,
            metric_key: 'breakfast_occurred',
            title: 'Breakfast occurred',
            value_type: 'boolean',
            unit: null,
            scale_min: null,
            scale_max: null,
            evidence_text: 'completely unrelated phrase xyz',
            value_boolean: true,
            value_number: null,
            observed_date: '2026-06-01',
            observed_at: null,
            observed_at_precision: 'date_only',
            reasoning: 'Bad evidence.',
          },
        },
        [],
      ),
    ).rejects.toThrow(/not grounded/i);
  });
});
