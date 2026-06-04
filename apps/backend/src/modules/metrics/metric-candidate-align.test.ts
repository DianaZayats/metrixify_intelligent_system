import { describe, expect, it } from 'vitest';
import { alignCandidateToDefinition, clampOrdinalToScale } from './metric-candidate-align.js';
import type { MetricCandidate } from './metric-extraction.schemas.js';

function ordinalCandidate(value: number, scaleMax = 5): MetricCandidate {
  return {
    candidate_key: 'symptom_severity',
    title: 'Symptom severity',
    value_type: 'ordinal',
    value_number: value,
    value_text: null,
    value_boolean: null,
    unit: null,
    scale_min: 1,
    scale_max: scaleMax,
    confidence: 0.9,
    evidence_text: '7 із 10',
    reasoning: null,
    observed_date: null,
    observed_at: null,
    observed_at_precision: null,
    narrative_order: null,
    tags: [],
  };
}

describe('alignCandidateToDefinition', () => {
  it('rescales 7/10 candidate to existing 1–5 definition', () => {
    const aligned = alignCandidateToDefinition(ordinalCandidate(7, 10), {
      valueType: 'ordinal',
      scaleMin: 1,
      scaleMax: 5,
    });
    expect(aligned.value_number).toBe(4);
    expect(aligned.scale_max).toBe(5);
  });
});

describe('clampOrdinalToScale', () => {
  it('clamps absurd values into scale', () => {
    const clamped = clampOrdinalToScale(ordinalCandidate(42));
    expect(clamped.value_number).toBe(5);
  });
});
