import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiaryEntry, MetricDefinition } from '@prisma/client';
import { resolveSchemaForEntry } from './metric-schema-resolver.service.js';

const mocks = vi.hoisted(() => ({
  findDiaryEntryById: vi.fn(),
  listObservationsByEntry: vi.fn(),
  listActiveMetricDefinitions: vi.fn(),
  reassignObservationToDefinition: vi.fn(),
  addAliasesToDefinition: vi.fn(),
  archiveEmptyDefinitionsFromEntry: vi.fn(),
  hasValidSchemaResolverRun: vi.fn(),
  markEntrySchemaResolveSuccess: vi.fn(),
  markEntrySchemaResolveFailed: vi.fn(),
  prismaAiRunCreate: vi.fn(),
  prismaMetricDefinitionFindFirst: vi.fn(),
}));

vi.mock('../entries/entry.repository.js', () => ({
  findDiaryEntryById: mocks.findDiaryEntryById,
  markEntrySchemaResolveSuccess: mocks.markEntrySchemaResolveSuccess,
  markEntrySchemaResolveFailed: mocks.markEntrySchemaResolveFailed,
}));

vi.mock('./metric.repository.js', () => ({
  listObservationsByEntry: mocks.listObservationsByEntry,
  listActiveMetricDefinitions: mocks.listActiveMetricDefinitions,
  reassignObservationToDefinition: mocks.reassignObservationToDefinition,
  addAliasesToDefinition: mocks.addAliasesToDefinition,
  archiveEmptyDefinitionsFromEntry: mocks.archiveEmptyDefinitionsFromEntry,
  hasValidSchemaResolverRun: mocks.hasValidSchemaResolverRun,
}));

vi.mock('../../shared/db/prisma.js', () => ({
  prisma: {
    aiRun: { create: mocks.prismaAiRunCreate },
    metricDefinition: { findFirst: mocks.prismaMetricDefinitionFindFirst },
  },
}));

function entry(overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id: 'entry-1',
    userId: 'user-1',
    sourceType: 'text',
    rawText: 'Felt low',
    transcriptText: null,
    summaryText: 'Low mood',
    entryDate: new Date('2026-05-19T00:00:00.000Z'),
    processingStatus: 'resolving_schema',
    processingError: null,
    createdAt: new Date('2026-05-19T00:00:00.000Z'),
    updatedAt: new Date('2026-05-19T00:00:00.000Z'),
    ...overrides,
  };
}

function definition(overrides: Partial<MetricDefinition> = {}): MetricDefinition {
  return {
    id: overrides.id ?? 'def-wellbeing',
    userId: 'user-1',
    key: overrides.key ?? 'wellbeing',
    title: overrides.title ?? 'Wellbeing',
    description: null,
    valueType: 'ordinal',
    unit: null,
    scaleMin: 1,
    scaleMax: 5,
    positiveDirection: 'neutral',
    aliasesJson: overrides.aliasesJson ?? ['Wellbeing'],
    extractionRulesJson: null,
    createdBy: 'ai',
    createdFromEntryId: 'entry-1',
    confidence: 0.9,
    version: 1,
    status: 'active',
    createdAt: new Date('2026-05-19T00:00:00.000Z'),
    updatedAt: new Date('2026-05-19T00:00:00.000Z'),
    ...overrides,
  };
}

describe('resolveSchemaForEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasValidSchemaResolverRun.mockResolvedValue(false);
    mocks.findDiaryEntryById.mockResolvedValue(entry());
    mocks.markEntrySchemaResolveSuccess.mockResolvedValue(entry({ processingStatus: 'completed' }));
    mocks.archiveEmptyDefinitionsFromEntry.mockResolvedValue(1);
    mocks.reassignObservationToDefinition.mockResolvedValue({});
    mocks.addAliasesToDefinition.mockResolvedValue({});
    mocks.prismaAiRunCreate.mockResolvedValue({});
  });

  it('links observation when alias matches deterministically', async () => {
    const mood = definition({ id: 'def-mood', key: 'mood', title: 'Mood', aliasesJson: ['Mood'] });
    const wellbeing = definition({
      id: 'def-wellbeing',
      key: 'wellbeing',
      title: 'Wellbeing',
      aliasesJson: ['Wellbeing', 'Mood'],
    });

    mocks.listActiveMetricDefinitions.mockResolvedValue([mood, wellbeing]);
    mocks.listObservationsByEntry.mockResolvedValue([
      {
        id: 'obs-1',
        userId: 'user-1',
        entryId: 'entry-1',
        metricDefinitionId: mood.id,
        observedAt: new Date('2026-05-19T00:00:00.000Z'),
        periodStart: null,
        periodEnd: null,
        valueNumber: 2,
        valueText: null,
        valueBoolean: null,
        confidence: 0.9,
        evidenceText: 'felt low',
        source: 'ai',
        metadataJson: null,
        createdAt: new Date('2026-05-19T00:00:00.000Z'),
        updatedAt: new Date('2026-05-19T00:00:00.000Z'),
        metricDefinition: mood,
      },
    ]);

    const result = await resolveSchemaForEntry(
      { entryId: 'entry-1', userId: 'user-1' },
      { chat: { completeStructured: vi.fn() } },
    );

    expect(result.linkedCount).toBe(1);
    expect(mocks.reassignObservationToDefinition).toHaveBeenCalledWith({
      observationId: 'obs-1',
      userId: 'user-1',
      targetMetricDefinitionId: wellbeing.id,
    });
    expect(mocks.markEntrySchemaResolveSuccess).toHaveBeenCalledWith('entry-1');
  });

  it('does not cross-link peanut metrics via polluted key aliases when candidateKey matches', async () => {
    const nuts = definition({
      id: 'def-nuts',
      key: 'nuts_consumed',
      title: 'Nuts consumed',
      valueType: 'boolean',
      aliasesJson: ['Nuts consumed', 'skin_rash_occurred'],
    });
    const rash = definition({
      id: 'def-rash',
      key: 'skin_rash_occurred',
      title: 'Skin rash occurred',
      valueType: 'boolean',
      aliasesJson: ['Skin rash occurred', 'nuts_consumed'],
    });

    mocks.listActiveMetricDefinitions.mockResolvedValue([nuts, rash]);
    mocks.listObservationsByEntry.mockResolvedValue([
      {
        id: 'obs-nuts',
        userId: 'user-1',
        entryId: 'entry-1',
        metricDefinitionId: nuts.id,
        observedAt: new Date('2026-01-01T12:00:00.000Z'),
        periodStart: null,
        periodEnd: null,
        valueNumber: null,
        valueText: null,
        valueBoolean: true,
        confidence: 0.92,
        evidenceText: '1 січня — перекусив горіхами, без висипу.',
        source: 'ai',
        metadataJson: { candidateKey: 'nuts_consumed' },
        createdAt: new Date('2026-05-19T00:00:00.000Z'),
        updatedAt: new Date('2026-05-19T00:00:00.000Z'),
        metricDefinition: nuts,
      },
      {
        id: 'obs-rash',
        userId: 'user-1',
        entryId: 'entry-1',
        metricDefinitionId: rash.id,
        observedAt: new Date('2026-01-01T12:00:00.000Z'),
        periodStart: null,
        periodEnd: null,
        valueNumber: null,
        valueText: null,
        valueBoolean: false,
        confidence: 0.92,
        evidenceText: '1 січня — перекусив горіхами, без висипу.',
        source: 'ai',
        metadataJson: { candidateKey: 'skin_rash_occurred' },
        createdAt: new Date('2026-05-19T00:00:00.000Z'),
        updatedAt: new Date('2026-05-19T00:00:00.000Z'),
        metricDefinition: rash,
      },
    ]);

    const result = await resolveSchemaForEntry(
      { entryId: 'entry-1', userId: 'user-1' },
      { chat: { completeStructured: vi.fn() } },
    );

    expect(result.linkedCount).toBe(0);
    expect(mocks.reassignObservationToDefinition).not.toHaveBeenCalled();
  });
});
