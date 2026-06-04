import { describe, expect, it } from 'vitest';
import type { MetricDefinition } from '@prisma/client';
import { formatObservationValue, resolveMetricTitle, resolveMetricTags, toMetricListItem } from './metric.mapper.js';

describe('formatObservationValue', () => {
  it('formats ordinal with scale range', () => {
    expect(
      formatObservationValue(
        { valueNumber: 3, valueText: null, valueBoolean: null },
        { valueType: 'ordinal', unit: null, scaleMin: 1, scaleMax: 5 },
      ),
    ).toBe('3 (1–5)');
  });

  it('formats number with unit', () => {
    expect(
      formatObservationValue(
        { valueNumber: 40, valueText: null, valueBoolean: null },
        { valueType: 'number', unit: 'min', scaleMin: null, scaleMax: null },
      ),
    ).toBe('40 min');
  });

  it('formats boolean', () => {
    expect(
      formatObservationValue(
        { valueNumber: null, valueText: null, valueBoolean: true },
        undefined,
      ),
    ).toBe('yes');
    expect(
      formatObservationValue(
        { valueNumber: null, valueText: null, valueBoolean: false },
        undefined,
        'uk',
      ),
    ).toBe('ні');
  });
});

describe('metric i18n mappers', () => {
  const baseDefinition = {
    id: 'def-1',
    userId: 'user-1',
    key: 'wellbeing',
    title: 'Wellbeing',
    titleI18n: { en: 'Wellbeing', uk: 'Самопочуття' },
    description: null,
    descriptionI18n: null,
    valueType: 'ordinal',
    unit: null,
    scaleMin: 1,
    scaleMax: 5,
    positiveDirection: 'neutral',
    aliasesJson: [],
    tagsJson: ['mood'],
    tagsI18n: { mood: { en: 'Mood', uk: 'Настрій' } },
    extractionRulesJson: null,
    createdBy: 'ai',
    createdFromEntryId: null,
    confidence: 0.9,
    version: 1,
    status: 'active',
    createdAt: new Date('2026-05-19T10:00:00Z'),
    updatedAt: new Date('2026-05-19T10:00:00Z'),
    observationCount: 1,
    lastObservedAt: new Date('2026-05-19T10:00:00Z'),
  } as MetricDefinition & { observationCount: number; lastObservedAt: Date | null };

  it('resolveMetricTitle uses uk when locale is uk', () => {
    expect(resolveMetricTitle(baseDefinition, 'uk')).toBe('Самопочуття');
  });

  it('resolveMetricTags uses uk labels', () => {
    expect(resolveMetricTags(baseDefinition, 'uk')).toEqual(['Настрій']);
  });

  it('toMetricListItem falls back to title when i18n missing', () => {
    const item = toMetricListItem(
      {
        ...baseDefinition,
        titleI18n: null,
      },
      'uk',
    );
    expect(item.title).toBe('Wellbeing');
  });
});
