import { describe, expect, it } from 'vitest';
import type { MetricCandidate } from './metric-extraction.schemas.js';
import { isMetricGroundedInEntryText } from './metric-extraction-grounding.js';

function candidate(partial: Partial<MetricCandidate> & Pick<MetricCandidate, 'candidate_key' | 'title' | 'evidence_text'>): MetricCandidate {
  return {
    value_type: 'boolean',
    value_number: null,
    value_text: null,
    value_boolean: true,
    unit: null,
    scale_min: null,
    scale_max: null,
    confidence: 0.9,
    reasoning: null,
    observed_date: null,
    observed_at: null,
    observed_at_precision: null,
    narrative_order: null,
    tags: [],
    ...partial,
  };
}

describe('isMetricGroundedInEntryText', () => {
  it('rejects whole-entry evidence when metric subject is not named', () => {
    const entryText = 'Снова новая эстрасистола';
    expect(
      isMetricGroundedInEntryText(
        candidate({
          candidate_key: 'nuts_consumed',
          title: 'Nuts consumed',
          evidence_text: entryText,
        }),
        entryText,
        'Споживання горіхів',
        ['горіхи'],
      ),
    ).toBe(false);
  });

  it('rejects metrics not mentioned in a short unrelated entry', () => {
    const entryText = 'Снова новая эстрасистола';
    expect(
      isMetricGroundedInEntryText(
        candidate({
          candidate_key: 'nuts_consumed',
          title: 'Nuts consumed',
          evidence_text: entryText,
        }),
        entryText,
        'Споживання горіхів',
        ['горіхи'],
      ),
    ).toBe(false);
  });

  it('accepts metrics when entry names the subject', () => {
    const entryText = 'Снова новая эстрасистола';
    expect(
      isMetricGroundedInEntryText(
        candidate({
          candidate_key: 'estradiol_new_pack',
          title: 'New estradiol pack',
          evidence_text: 'эстрасистола',
        }),
        entryText,
      ),
    ).toBe(true);
  });

  it('rejects evidence that is not a substring of the entry', () => {
    expect(
      isMetricGroundedInEntryText(
        candidate({
          candidate_key: 'skin_rash_occurred',
          title: 'Skin rash',
          evidence_text: 'висип на шкірі',
        }),
        'Снова новая эстрасистола',
        'Висип на шкірі',
      ),
    ).toBe(false);
  });

  it('accepts evidence when LLM adds trailing period but entry has comma', () => {
    const entryText =
      'Енергія вище середньої, настрій рівний. Симптоми 1–2 із 10, майже не заважали.';
    expect(
      isMetricGroundedInEntryText(
        candidate({
          candidate_key: 'acute_energy_level',
          title: 'Energy level',
          value_type: 'ordinal',
          value_number: 4,
          evidence_text: 'Енергія вище середньої.',
        }),
        entryText,
        'Рівень енергії',
        ['енергія'],
      ),
    ).toBe(true);
  });

  it('rejects sleep quality when entry never mentions sleep', () => {
    const entryText = 'Без алкоголю, жирна їжа ввечері, активності не було.';
    expect(
      isMetricGroundedInEntryText(
        candidate({
          candidate_key: 'night_sleep_quality',
          title: 'Night sleep quality',
          value_type: 'ordinal',
          value_number: 3,
          evidence_text: 'activnosti ne bulo',
        }),
        entryText,
      ),
    ).toBe(false);
  });

  it('rejects energy metric when entry compares recovery without naming energy', () => {
    const entryText = 'Порівняно з учора стало легше, але тіло ще не повністю відновилося.';
    expect(
      isMetricGroundedInEntryText(
        candidate({
          candidate_key: 'acute_energy_level',
          title: 'Energy level',
          value_type: 'ordinal',
          value_number: 2,
          evidence_text: 'порівняно з учора стало легше',
        }),
        entryText,
      ),
    ).toBe(false);
  });

  it('accepts stress metric when entry mentions тривожність', () => {
    const entryText = 'День робочий, без сильної тривожності.';
    expect(
      isMetricGroundedInEntryText(
        candidate({
          candidate_key: 'stress_level',
          title: 'Рівень стресу',
          value_type: 'ordinal',
          value_number: 2,
          evidence_text: 'без сильної тривожності',
        }),
        entryText,
        'Рівень стресу',
        ['стрес'],
      ),
    ).toBe(true);
  });
});
