import { describe, expect, it } from 'vitest';
import { capInferredOrdinalConfidence } from './metric-inference-cap.js';

describe('metric-inference-cap', () => {
  it('caps inferred ordinal confidence at 0.75', () => {
    const candidate = {
      candidate_key: 'breakfast_quality',
      title: 'Breakfast quality',
      value_type: 'ordinal' as const,
      value_number: 2,
      value_text: null,
      value_boolean: null,
      unit: null,
      scale_min: 1,
      scale_max: 5,
      evidence_text: 'покушал бургером из макдональдса',
      confidence: 0.9,
      reasoning: null,
      observed_date: null,
      observed_at: null,
      observed_at_precision: 'inferred' as const,
      narrative_order: 2,
      tags: ['nutrition'],
    };

    const capped = capInferredOrdinalConfidence(candidate, candidate.evidence_text);
    expect(capped.confidence).toBe(0.75);
  });

  it('keeps explicit rating confidence unchanged', () => {
    const candidate = {
      candidate_key: 'wellbeing',
      title: 'Wellbeing',
      value_type: 'ordinal' as const,
      value_number: 3,
      value_text: null,
      value_boolean: null,
      unit: null,
      scale_min: 1,
      scale_max: 5,
      evidence_text: 'оцениваю на 3 из 5',
      confidence: 0.92,
      reasoning: null,
      observed_date: null,
      observed_at: null,
      observed_at_precision: 'exact' as const,
      narrative_order: 1,
      tags: ['mood'],
    };

    const capped = capInferredOrdinalConfidence(candidate, candidate.evidence_text);
    expect(capped.confidence).toBe(0.92);
  });
});
