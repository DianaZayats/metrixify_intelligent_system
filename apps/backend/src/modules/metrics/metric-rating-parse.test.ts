import { describe, expect, it } from 'vitest';
import {
  applyExplicitRatingFromEntryText,
  applyRelativeOrdinalFromEntryText,
  findExplicitRatings,
  fitOrdinalCandidateToScale,
  rescaleOrdinalValue,
} from './metric-rating-parse.js';

describe('findExplicitRatings', () => {
  it('finds Russian explicit ratings', () => {
    expect(findExplicitRatings('настроение так себе, поставил бы 3 из 5')).toEqual([
      { value: 3, scaleMax: 5, match: '3 из 5' },
    ]);
  });

  it('finds Ukrainian explicit ratings', () => {
    expect(findExplicitRatings('епізод після сніданку дійшов до 7 із 10')).toEqual([
      { value: 7, scaleMax: 10, match: '7 із 10' },
    ]);
  });
});

describe('rescaleOrdinalValue', () => {
  it('maps 7/10 to 1–5 scale', () => {
    expect(
      rescaleOrdinalValue({
        value: 7,
        sourceScaleMax: 10,
        targetScaleMin: 1,
        targetScaleMax: 5,
      }),
    ).toBe(4);
  });

  it('keeps 3/5 on 1–5 scale', () => {
    expect(
      rescaleOrdinalValue({
        value: 3,
        sourceScaleMax: 5,
        targetScaleMin: 1,
        targetScaleMax: 5,
      }),
    ).toBe(3);
  });
});

describe('applyExplicitRatingFromEntryText', () => {
  it('overrides inferred ordinal with explicit rating from entry text', () => {
    const candidate = {
      candidate_key: 'wellbeing',
      title: 'Wellbeing',
      value_type: 'ordinal' as const,
      value_number: 2,
      scale_min: 1,
      scale_max: 5,
      evidence_text: 'настроение было так себе',
      confidence: 0.7,
    };

    const updated = applyExplicitRatingFromEntryText(
      candidate,
      'Сегодня настроение было так себе, поставил бы 3 из 5',
    );

    expect(updated.value_number).toBe(3);
    expect(updated.confidence).toBeGreaterThanOrEqual(0.92);
  });

  it('rescales 7/10 to 1–5 when metric scale is 1–5', () => {
    const candidate = {
      candidate_key: 'symptom_severity',
      title: 'Symptom severity',
      value_type: 'ordinal' as const,
      value_number: 7,
      scale_min: 1,
      scale_max: 5,
      evidence_text: 'епізод після сніданку дійшов до 7 із 10',
      confidence: 0.75,
    };

    const updated = applyExplicitRatingFromEntryText(
      candidate,
      'Довгий епізод після сніданку, дійшов до 7 із 10',
    );

    expect(updated.value_number).toBe(4);
    expect(updated.scale_max).toBe(5);
  });
});

describe('fitOrdinalCandidateToScale', () => {
  it('rescales out-of-range LLM value using explicit rating in evidence', () => {
    const candidate = {
      value_type: 'ordinal' as const,
      value_number: 7,
      scale_min: 1,
      scale_max: 5,
      evidence_text: 'епізод після сніданку дійшов до 7 із 10',
    };

    const fitted = fitOrdinalCandidateToScale(candidate, 'Довгий епізод після сніданку');

    expect(fitted?.value_number).toBe(4);
  });

  it('clamps ordinal when value is out of range and scale is unknown', () => {
    const candidate = {
      value_type: 'ordinal' as const,
      value_number: 42,
      scale_min: 1,
      scale_max: 5,
      evidence_text: 'felt weird',
    };

    const fitted = fitOrdinalCandidateToScale(candidate, 'felt weird');
    expect(fitted?.value_number).toBe(5);
  });
});

describe('day 25 syndrome-track — symptom rating must not bleed into mood/energy', () => {
  const entryText =
    'День 25 (2026-03-25): Енергія вище середньої, настрій рівний. Симптоми 1–2 із 10, майже не заважали.';

  it('does not apply «2 із 10» from symptoms to energy', () => {
    const candidate = {
      candidate_key: 'acute_energy_level',
      title: 'Energy level',
      value_type: 'ordinal' as const,
      value_number: 2,
      scale_min: 1,
      scale_max: 5,
      evidence_text: 'енергія вище середньої',
      confidence: 0.75,
    };

    const updated = applyRelativeOrdinalFromEntryText(
      applyExplicitRatingFromEntryText(candidate, entryText),
      entryText,
    );

    expect(updated.value_number).toBe(4);
    expect(updated.evidence_text).not.toContain('2 із 10');
  });

  it('maps «настрій рівний» to neutral 3/5, not symptom scale', () => {
    const candidate = {
      candidate_key: 'morning_wellbeing',
      title: 'Morning wellbeing',
      value_type: 'ordinal' as const,
      value_number: 1,
      scale_min: 1,
      scale_max: 5,
      evidence_text: 'настрій рівний',
      confidence: 0.75,
    };

    const updated = applyRelativeOrdinalFromEntryText(
      applyExplicitRatingFromEntryText(candidate, entryText),
      entryText,
    );

    expect(updated.value_number).toBe(3);
  });

  it('documents that naive 2/10 → 1/5 rescale is misleading for wellbeing', () => {
    expect(
      rescaleOrdinalValue({
        value: 2,
        sourceScaleMax: 10,
        targetScaleMin: 1,
        targetScaleMax: 5,
      }),
    ).toBe(1);
    expect(findExplicitRatings('Симптоми 1–2 із 10')).toEqual([
      { value: 2, scaleMax: 10, match: '2 із 10' },
    ]);
  });
});

describe('day 24 — symptom 3/10 must not bleed into caffeine, energy, stress', () => {
  const entryText =
    'День 24 (2026-03-24): Порівняно з учора стало легше, але тіло ще не повністю відновилося. Сон 7,5 годин, їжа звичайна, кава одна чашка. Симптоми 3 із 10, короткими хвилями після їжі. День робочий, без сильної тривожності.';

  it('does not attach «3 із 10» to caffeine number metric', () => {
    const candidate = {
      candidate_key: 'caffeine_intake',
      title: 'Caffeine',
      value_type: 'number' as const,
      value_number: 3,
      scale_min: null,
      scale_max: null,
      evidence_text: 'кава одна чашка',
      confidence: 0.95,
    };

    const updated = applyExplicitRatingFromEntryText(candidate, entryText);
    expect(updated.value_number).toBe(3);
    expect(updated.evidence_text).not.toContain('3 із 10');
  });

  it('does not attach «3 із 10» to comparative recovery phrase', () => {
    const candidate = {
      candidate_key: 'acute_energy_level',
      title: 'Energy',
      value_type: 'ordinal' as const,
      value_number: 3,
      scale_min: 1,
      scale_max: 5,
      evidence_text: 'порівняно з учора стало легше',
      confidence: 0.92,
    };

    const updated = applyExplicitRatingFromEntryText(candidate, entryText);
    expect(updated.evidence_text).not.toContain('3 із 10');
  });

  it('maps low anxiety phrase on stress metric', () => {
    const candidate = {
      candidate_key: 'stress_level',
      title: 'Stress',
      value_type: 'ordinal' as const,
      value_number: 3,
      scale_min: 1,
      scale_max: 10,
      evidence_text: 'без сильної тривожності',
      confidence: 0.92,
    };

    const updated = applyRelativeOrdinalFromEntryText(
      applyExplicitRatingFromEntryText(candidate, entryText),
      entryText,
    );

    expect(updated.value_number).toBe(2);
    expect(updated.evidence_text).not.toContain('3 із 10');
  });

  it('maps «високий стрес» to ~8/10 on stress scale', () => {
    const entryText =
      'День 23 (2026-03-23): мало сну, високий стрес і майже весь день без нормального обіду.';
    const candidate = {
      candidate_key: 'stress_level',
      title: 'Stress level',
      value_type: 'ordinal' as const,
      value_number: 3,
      scale_min: 1,
      scale_max: 10,
      evidence_text: 'високий стрес',
      confidence: 0.88,
    };

    const updated = applyRelativeOrdinalFromEntryText(
      applyExplicitRatingFromEntryText(candidate, entryText),
      entryText,
    );

    expect(updated.value_number).toBe(8);
  });
});
