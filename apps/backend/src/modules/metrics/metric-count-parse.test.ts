import { describe, expect, it } from 'vitest';
import { applyExplicitCountFromEntryText } from './metric-count-parse.js';

describe('applyExplicitCountFromEntryText', () => {
  const entryText =
    'День 24 (2026-03-24): Сон 7,5 годин, їжа звичайна, кава одна чашка. Симптоми 3 із 10, короткими хвилями після їжі.';

  it('parses «одна чашка» as 1 cup, not symptom 3/10', () => {
    const candidate = {
      candidate_key: 'caffeine_intake',
      title: 'Caffeine intake',
      value_type: 'number' as const,
      value_number: 3,
      evidence_text: 'кава одна чашка',
      confidence: 0.95,
    };

    const updated = applyExplicitCountFromEntryText(candidate, entryText);
    expect(updated.value_number).toBe(1);
  });
});
