import { describe, expect, it } from 'vitest';
import { classifyProfileFactReliability } from './profile-fact-reliability.js';

describe('classifyProfileFactReliability', () => {
  it('marks high confidence with multiple evidence as likely fact', () => {
    expect(classifyProfileFactReliability(0.9, 2)).toBe('likely_fact');
    expect(classifyProfileFactReliability(0.85, 3)).toBe('likely_fact');
  });

  it('marks low confidence or sparse evidence as hypothesis', () => {
    expect(classifyProfileFactReliability(0.9, 1)).toBe('hypothesis');
    expect(classifyProfileFactReliability(0.84, 5)).toBe('hypothesis');
    expect(classifyProfileFactReliability(0.75, 2)).toBe('hypothesis');
    expect(classifyProfileFactReliability(null, 4)).toBe('hypothesis');
  });
});
