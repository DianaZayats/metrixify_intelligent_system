import type { ProfileFact } from '@prisma/client';
import type { ProfileFactCandidate } from './profile-fact.schemas.js';

export const PROFILE_FACT_MIN_CONFIDENCE = 0.7;

export function normalizeProfileFactKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function normalizeEvidenceForMatch(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.!?…]+$/g, '')
    .replace(/\s+/g, ' ');
}

export function evidenceWordOverlapRatio(evidenceText: string, entryText: string): number {
  const evidence = normalizeEvidenceForMatch(evidenceText);
  const text = normalizeEvidenceForMatch(entryText);
  const words = evidence.split(' ').filter((word) => word.length >= 4);
  if (words.length === 0) {
    return 0;
  }
  const matched = words.filter((word) => text.includes(word)).length;
  return matched / words.length;
}

export function evidenceAppearsInEntryText(evidenceText: string, entryText: string): boolean {
  const evidence = normalizeEvidenceForMatch(evidenceText);
  const text = normalizeEvidenceForMatch(entryText);
  if (!evidence || !text) {
    return false;
  }
  if (text.includes(evidence)) {
    return true;
  }
  // LLM often ends evidence with "." while entry continues with "," — already handled above.
  // Allow a shorter core phrase when the model prefixes a clause not copied verbatim.
  const core = evidence.replace(/[,;:]+$/g, '').trim();
  return core.length >= 10 && text.includes(core);
}

export type ProfileFactFilterReason =
  | 'temporary'
  | 'low_confidence'
  | 'missing_evidence'
  | 'skip_operation';

export type FilteredProfileFactCandidate = {
  candidate: ProfileFactCandidate;
  normalizedKey: string;
  rejected: false;
} | {
  candidate: ProfileFactCandidate;
  normalizedKey: string;
  rejected: true;
  reason: ProfileFactFilterReason;
};

export function filterProfileFactCandidate(
  candidate: ProfileFactCandidate,
  entryText: string,
): FilteredProfileFactCandidate {
  const normalizedKey = normalizeProfileFactKey(candidate.key);

  if (candidate.operation === 'skip') {
    return { candidate, normalizedKey, rejected: true, reason: 'skip_operation' };
  }

  if (candidate.stability === 'temporary') {
    return { candidate, normalizedKey, rejected: true, reason: 'temporary' };
  }

  if (candidate.confidence < PROFILE_FACT_MIN_CONFIDENCE) {
    return { candidate, normalizedKey, rejected: true, reason: 'low_confidence' };
  }

  if (!evidenceAppearsInEntryText(candidate.evidence_text, entryText)) {
    return { candidate, normalizedKey, rejected: true, reason: 'missing_evidence' };
  }

  return { candidate, normalizedKey, rejected: false };
}

export type ResolvedProfileFactOperation =
  | { action: 'create' }
  | { action: 'update'; existingFact: ProfileFact }
  | { action: 'add_evidence'; existingFact: ProfileFact };

export function resolveProfileFactOperation(
  candidate: ProfileFactCandidate,
  normalizedKey: string,
  existingFact: ProfileFact | null,
): ResolvedProfileFactOperation | null {
  if (existingFact) {
    if (candidate.operation === 'add_fact_evidence') {
      return { action: 'add_evidence', existingFact };
    }
    if (candidate.operation === 'update_fact' || candidate.operation === 'create_fact') {
      return { action: 'update', existingFact };
    }
    return null;
  }

  if (candidate.operation === 'create_fact') {
    return { action: 'create' };
  }

  if (candidate.operation === 'update_fact' || candidate.operation === 'add_fact_evidence') {
    return null;
  }

  return null;
}

export function buildValueJson(valueText: string): { text: string } {
  return { text: valueText.trim() };
}

export function parseValueJsonText(valueJson: unknown): string {
  if (!valueJson || typeof valueJson !== 'object' || Array.isArray(valueJson)) {
    return '';
  }
  const text = (valueJson as Record<string, unknown>).text;
  return typeof text === 'string' ? text.trim() : '';
}
