import { describe, expect, it } from 'vitest';
import {
  applyGenericIntensityToOrdinal,
  detectIntensityLevel,
  intensityLevelToOrdinalValue,
} from './metric-intensity-parse.js';

describe('detectIntensityLevel', () => {
  it('detects high stress without metric key', () => {
    expect(detectIntensityLevel('високий стрес')).toBe('high');
  });

  it('detects above-normal phrasing', () => {
    expect(detectIntensityLevel('Стрес вищий за звичайний')).toBe('high');
    expect(detectIntensityLevel('енергія вище середньої')).toBe('high');
  });

  it('detects neutral mood', () => {
    expect(detectIntensityLevel('настрій рівний')).toBe('mid');
  });

  it('detects low anxiety negation', () => {
    expect(detectIntensityLevel('без сильної тривожності')).toBe('very_low');
  });
});

describe('applyGenericIntensityToOrdinal', () => {
  const base = {
    value_type: 'ordinal' as const,
    value_number: 3,
    scale_min: 1,
    scale_max: 10,
    evidence_text: 'високий стрес',
    confidence: 0.8,
  };

  it('maps high intensity to ~8/10 on any ordinal metric', () => {
    const updated = applyGenericIntensityToOrdinal(base, [base.evidence_text]);
    expect(updated?.value_number).toBe(8);
  });

  it('maps above-average to ~4/5 on 1–5 scale', () => {
    const updated = applyGenericIntensityToOrdinal(
      {
        ...base,
        scale_max: 5,
        evidence_text: 'енергія вище середньої',
      },
      ['енергія вище середньої'],
    );
    expect(updated?.value_number).toBe(4);
  });

  it('maps very low anxiety to ~2/10', () => {
    const updated = applyGenericIntensityToOrdinal(
      {
        ...base,
        evidence_text: 'без сильної тривожності',
      },
      ['без сильної тривожності'],
    );
    expect(updated?.value_number).toBe(2);
  });

  it('returns null for non-ordinal', () => {
    expect(
      applyGenericIntensityToOrdinal(
        { ...base, value_type: 'number' },
        [base.evidence_text],
      ),
    ).toBeNull();
  });
});

describe('intensityLevelToOrdinalValue', () => {
  it('uses scale bounds', () => {
    expect(intensityLevelToOrdinalValue('mid', 0, 10)).toBe(5);
  });
});
