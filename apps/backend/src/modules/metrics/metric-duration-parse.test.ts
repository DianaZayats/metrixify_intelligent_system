import { describe, expect, it } from 'vitest';
import {
  applyExplicitDurationFromEntryText,
  findHourDurationInEvidence,
  findRepeatedSessionMultiplier,
  resolveExplicitDurationMinutes,
} from './metric-duration-parse.js';

describe('metric-duration-parse cross-entry isolation', () => {
  it('does not borrow duration from unrelated entry text', () => {
    const candidate = {
      candidate_key: 'run_duration_minutes',
      value_type: 'number' as const,
      value_number: 60,
      unit: 'min',
      evidence_text: 'час пробежал в парке',
      confidence: 0.9,
    };

    const updated = applyExplicitDurationFromEntryText(
      candidate,
      'Вчера вечером час пробежал в парке. Сегодня утром 45 минут был в зале',
    );

    expect(updated.value_number).toBe(60);
    expect(updated.evidence_text).not.toContain('45');
  });

  it('parses hour phrasing in evidence', () => {
    expect(findHourDurationInEvidence('час пробежал в парке')).toEqual({
      value: 60,
      unit: 'min',
      match: 'час',
    });
  });

  it('multiplies repeated nap sessions', () => {
    const evidence = 'два раза лёг поспать по минут сорок';
    expect(findRepeatedSessionMultiplier(evidence)).toBe(2);
    expect(resolveExplicitDurationMinutes(evidence)).toBe(80);
  });

  it('keeps LLM total when already summed for repeated sessions', () => {
    const evidence = 'два раза лёг поспать по минут сорок';
    expect(resolveExplicitDurationMinutes(evidence, { existingValue: 80 })).toBe(80);
  });
});
