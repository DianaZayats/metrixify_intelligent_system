import { describe, expect, it } from 'vitest';
import {
  assertCandidateHasValue,
  normalizeMetricKey,
  normalizeObservationValue,
  uniqueMetricTags,
} from './metric-normalization.js';
import type { MetricCandidate } from './metric-extraction.schemas.js';

function candidate(overrides: Partial<MetricCandidate> = {}): MetricCandidate {
  return {
    candidate_key: 'wellbeing',
    title: 'Wellbeing',
    value_type: 'ordinal',
    value_number: 3,
    value_text: null,
    value_boolean: null,
    unit: null,
    scale_min: 1,
    scale_max: 5,
    evidence_text: 'felt tired',
    confidence: 0.8,
    reasoning: null,
    observed_date: null,
    tags: ['mood'],
    ...overrides,
  };
}

describe('normalizeMetricKey', () => {
  it('slugifies keys', () => {
    expect(normalizeMetricKey('Wake Time Quality')).toBe('wake_time_quality');
  });
});

describe('normalizeObservationValue', () => {
  it('maps ordinal to valueNumber', () => {
    const normalized = normalizeObservationValue(candidate());
    expect(normalized.valueNumber).toBe(3);
    expect(normalized.valueText).toBeNull();
  });

  it('throws when candidate has no value', () => {
    const empty = candidate({ value_number: null, value_type: 'ordinal' });
    expect(() => assertCandidateHasValue(empty, normalizeObservationValue(empty))).toThrow();
  });
});

describe('uniqueMetricTags', () => {
  it('normalizes and deduplicates tags', () => {
    expect(uniqueMetricTags(['Mood', 'mental health', 'mood'])).toEqual(['mood', 'mental-health']);
  });
});
