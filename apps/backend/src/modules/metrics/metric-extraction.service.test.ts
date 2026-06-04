import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractMetricsForEntry } from './metric-extraction.service.js';

const findEntry = vi.fn();
const markSuccess = vi.fn();
const markFailed = vi.fn();
const hasRun = vi.fn();
const findDef = vi.fn();
const ensureDef = vi.fn();
const createObs = vi.fn();
const aiRunCreate = vi.fn();

vi.mock('../entries/entry.repository.js', () => ({
  findDiaryEntryById: (...args: unknown[]) => findEntry(...args),
  markEntryExtractionSuccess: (...args: unknown[]) => markSuccess(...args),
  markEntryExtractionFailed: (...args: unknown[]) => markFailed(...args),
}));

vi.mock('./metric.repository.js', () => ({
  hasValidMetricExtractionRun: (...args: unknown[]) => hasRun(...args),
  findMetricDefinitionByKeyAnyStatus: (...args: unknown[]) => findDef(...args),
  ensureMetricDefinitionForCandidate: (...args: unknown[]) => ensureDef(...args),
  createMetricObservation: (...args: unknown[]) => createObs(...args),
  resolveMetricKey: (candidate: { candidate_key: string }) => candidate.candidate_key,
}));

vi.mock('./metric-extraction-context.js', () => ({
  buildMetricExtractionContextPack: vi.fn().mockResolvedValue({
    schema_version: '1',
    entry: { id: 'entry-1', entry_date: '2026-05-19', recorded_at: '2026-05-19T12:00:00.000Z', source_type: 'text', text: 'tired' },
    user: { timezone: 'UTC' },
    existing_metrics: [],
  }),
}));

vi.mock('../../shared/db/prisma.js', () => ({
  prisma: {
    aiRun: { create: (...args: unknown[]) => aiRunCreate(...args) },
  },
}));

describe('extractMetricsForEntry', () => {
  beforeEach(() => {
    findEntry.mockReset();
    markSuccess.mockReset();
    markFailed.mockReset();
    hasRun.mockReset();
    findDef.mockReset();
    ensureDef.mockReset();
    createObs.mockReset();
    aiRunCreate.mockReset();
    hasRun.mockResolvedValue(false);
    findDef.mockResolvedValue(null);
    ensureDef.mockResolvedValue({ id: 'def-1' });
  });

  it('creates definitions and observations on success', async () => {
    findEntry.mockResolvedValue({
      id: 'entry-1',
      userId: 'user-1',
      rawText: 'felt tired',
      entryDate: new Date('2026-05-19T00:00:00.000Z'),
      createdAt: new Date('2026-05-19T20:00:00.000Z'),
      processingStatus: 'extracting_metrics',
    });

    const chat = {
      completeStructured: vi.fn().mockResolvedValue({
        data: {
          metrics: [
            {
              candidate_key: 'wellbeing',
              title: 'Wellbeing',
              value_type: 'ordinal',
              value_number: 3,
              value_text: null,
              value_boolean: null,
              unit: null,
              scale_min: 1,
              scale_max: 5,
              evidence_text: 'tired',
              confidence: 0.8,
              reasoning: null,
              observed_date: null,
              observed_at: null,
              observed_at_precision: 'exact',
              narrative_order: 1,
              tags: ['mood'],
            },
          ],
        },
        model: 'gpt-4o-mini',
      }),
    };

    const result = await extractMetricsForEntry(
      { entryId: 'entry-1', userId: 'user-1', userTimezone: 'UTC' },
      { chat },
    );

    expect(result.metricCount).toBe(1);
    expect(ensureDef).toHaveBeenCalledOnce();
    expect(createObs).toHaveBeenCalledOnce();
    expect(markSuccess).toHaveBeenCalledWith('entry-1');
  });

  it('syncs display i18n when metric definition already exists', async () => {
    findEntry.mockResolvedValue({
      id: 'entry-1',
      userId: 'user-1',
      rawText: 'felt tired',
      entryDate: new Date('2026-05-19T00:00:00.000Z'),
      createdAt: new Date('2026-05-19T20:00:00.000Z'),
      processingStatus: 'extracting_metrics',
    });
    findDef.mockResolvedValue({ id: 'def-existing', status: 'active' });
    ensureDef.mockResolvedValue({ id: 'def-existing' });

    const chat = {
      completeStructured: vi.fn().mockResolvedValue({
        data: {
          metrics: [
            {
              candidate_key: 'wellbeing',
              title: 'Wellbeing',
              title_i18n: { en: 'Wellbeing', uk: 'Добробут' },
              tag_entries: [{ slug: 'mood', label_i18n: { en: 'Mood', uk: 'Настрій' } }],
              value_type: 'ordinal',
              value_number: 3,
              value_text: null,
              value_boolean: null,
              unit: null,
              scale_min: 1,
              scale_max: 5,
              evidence_text: 'tired',
              confidence: 0.8,
              reasoning: null,
              observed_date: null,
              observed_at: null,
              observed_at_precision: 'exact',
              narrative_order: 1,
              tags: ['mood'],
            },
          ],
        },
        model: 'gpt-4o-mini',
      }),
    };

    await extractMetricsForEntry(
      { entryId: 'entry-1', userId: 'user-1', userTimezone: 'UTC' },
      { chat },
    );

    expect(ensureDef).toHaveBeenCalledOnce();
    expect(createObs).toHaveBeenCalledOnce();
  });
});
