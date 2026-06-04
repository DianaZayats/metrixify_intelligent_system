import { describe, expect, it } from 'vitest';
import type { ProfileFactCandidate } from './profile-fact.schemas.js';
import {
  evidenceAppearsInEntryText,
  filterProfileFactCandidate,
  normalizeProfileFactKey,
  resolveProfileFactOperation,
} from './profile-fact-deduplication.js';

function candidate(overrides: Partial<ProfileFactCandidate> = {}): ProfileFactCandidate {
  return {
    key: 'job_title',
    value_text: 'Works as a software developer',
    fact_type: 'work',
    stability: 'stable',
    evidence_text: 'работаю разработчиком',
    confidence: 0.9,
    reasoning: 'test',
    operation: 'create_fact',
    ...overrides,
  };
}

describe('profile-fact-deduplication', () => {
  it('normalizes keys like metric keys', () => {
    expect(normalizeProfileFactKey(' Job Title ')).toBe('job_title');
    expect(normalizeProfileFactKey('pet-project!!!')).toBe('pet_project');
  });

  it('rejects temporary stability', () => {
    const result = filterProfileFactCandidate(
      candidate({ stability: 'temporary' }),
      'сегодня тревожно',
    );
    expect(result.rejected).toBe(true);
    if (result.rejected) {
      expect(result.reason).toBe('temporary');
    }
  });

  it('rejects low confidence', () => {
    const result = filterProfileFactCandidate(
      candidate({ confidence: 0.5 }),
      'работаю разработчиком',
    );
    expect(result.rejected).toBe(true);
    if (result.rejected) {
      expect(result.reason).toBe('low_confidence');
    }
  });

  it('requires evidence substring in entry text', () => {
    expect(evidenceAppearsInEntryText('работаю разработчиком', 'Я работаю разработчиком')).toBe(true);
    expect(
      evidenceAppearsInEntryText('Енергія вище середньої.', 'Енергія вище середньої, настрій рівний'),
    ).toBe(true);
    const result = filterProfileFactCandidate(
      candidate({ evidence_text: 'missing quote' }),
      'Я работаю разработчиком',
    );
    expect(result.rejected).toBe(true);
    if (result.rejected) {
      expect(result.reason).toBe('missing_evidence');
    }
  });

  it('maps create_fact to update when fact exists', () => {
    const existing = {
      id: 'fact-1',
      userId: 'user-1',
      key: 'job_title',
      valueJson: { text: 'Old value' },
      factType: 'work' as const,
      stability: 'stable' as const,
      confidence: 0.8,
      status: 'active' as const,
      firstSeenEntryId: null,
      lastSeenEntryId: null,
      evidenceCount: 1,
      validFrom: null,
      validTo: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const resolved = resolveProfileFactOperation(
      candidate({ operation: 'create_fact' }),
      'job_title',
      existing,
    );
    expect(resolved?.action).toBe('update');
  });
});
