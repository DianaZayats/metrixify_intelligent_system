import { describe, expect, it } from 'vitest';
import type { ProfileFact } from '@prisma/client';
import { resolveProfileFactValue, toProfileFactListItem } from './profile-fact.mapper.js';

describe('profile fact i18n mapper', () => {
  const fact = {
    id: 'fact-1',
    userId: 'user-1',
    key: 'job_title',
    valueJson: { text: 'Works as a software developer' },
    valueI18n: {
      en: 'Works as a software developer',
      uk: 'Працює розробником програмного забезпечення',
    },
    factType: 'work',
    stability: 'stable',
    confidence: 0.9,
    status: 'active',
    firstSeenEntryId: null,
    lastSeenEntryId: null,
    evidenceCount: 1,
    validFrom: null,
    validTo: null,
    createdAt: new Date('2026-05-19T10:00:00Z'),
    updatedAt: new Date('2026-05-19T10:00:00Z'),
  } as ProfileFact;

  it('resolveProfileFactValue prefers uk', () => {
    expect(resolveProfileFactValue(fact, 'uk')).toContain('розробником');
  });

  it('toProfileFactListItem falls back to valueJson text', () => {
    const legacy = { ...fact, valueI18n: null };
    expect(toProfileFactListItem(legacy, 'uk').valueText).toBe('Works as a software developer');
  });

  it('toProfileFactListItem classifies reliability from confidence and evidence', () => {
    expect(toProfileFactListItem(fact, 'en').reliability).toBe('hypothesis');
    expect(
      toProfileFactListItem({ ...fact, evidenceCount: 2 }, 'en').reliability,
    ).toBe('likely_fact');
  });
});
