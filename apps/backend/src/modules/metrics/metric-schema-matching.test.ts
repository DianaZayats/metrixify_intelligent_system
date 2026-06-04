import { describe, expect, it } from 'vitest';
import type { MetricDefinition } from '@prisma/client';
import {
  findDefinitionByExactLabel,
  findSimilarMetricDefinitions,
  labelSimilarityScore,
  scoreMetricSimilarity,
} from './metric-schema-matching.js';

function definition(overrides: Partial<MetricDefinition>): MetricDefinition {
  return {
    id: overrides.id ?? 'def-1',
    userId: overrides.userId ?? 'user-1',
    key: overrides.key ?? 'wellbeing',
    title: overrides.title ?? 'Wellbeing',
    description: overrides.description ?? null,
    valueType: overrides.valueType ?? 'ordinal',
    unit: overrides.unit ?? null,
    scaleMin: overrides.scaleMin ?? 1,
    scaleMax: overrides.scaleMax ?? 5,
    positiveDirection: overrides.positiveDirection ?? 'neutral',
    aliasesJson: overrides.aliasesJson ?? ['Wellbeing'],
    extractionRulesJson: overrides.extractionRulesJson ?? null,
    createdBy: overrides.createdBy ?? 'ai',
    createdFromEntryId: overrides.createdFromEntryId ?? null,
    confidence: overrides.confidence ?? 0.9,
    version: overrides.version ?? 1,
    status: overrides.status ?? 'active',
    createdAt: overrides.createdAt ?? new Date('2026-05-19T00:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-05-19T00:00:00.000Z'),
  };
}

describe('metric schema matching', () => {
  it('scores identical titles as 1', () => {
    expect(labelSimilarityScore('Wellbeing', 'wellbeing')).toBe(1);
  });

  it('finds exact alias matches', () => {
    const source = definition({ id: 'source', key: 'mood', title: 'Mood' });
    const target = definition({
      id: 'target',
      key: 'wellbeing',
      title: 'Wellbeing',
      aliasesJson: ['Mood'],
    });

    const match = scoreMetricSimilarity(source, target);
    expect(match?.score).toBe(1);
    expect(match?.reason).toBe('exact_alias');
  });

  it('finds definition by alias label', () => {
    const mood = definition({ id: 'mood', key: 'mood', title: 'Mood' });
    const wellbeing = definition({
      id: 'wellbeing',
      key: 'wellbeing',
      title: 'Wellbeing',
      aliasesJson: ['Mood'],
    });

    expect(findDefinitionByExactLabel('Mood', [wellbeing], mood.id)?.id).toBe('wellbeing');
  });

  it('returns semantic candidates above threshold', () => {
    const sleepQuality = definition({
      id: 'sleep-quality',
      key: 'sleep_quality',
      title: 'Sleep quality',
    });
    const sleep = definition({
      id: 'sleep',
      key: 'sleep',
      title: 'Sleep',
      aliasesJson: ['Sleep quality'],
    });

    const matches = findSimilarMetricDefinitions(sleepQuality, [sleep], { minScore: 0.45 });
    expect(matches[0]?.definition.id).toBe('sleep');
    expect(matches[0]?.score).toBeGreaterThanOrEqual(0.45);
  });
});
