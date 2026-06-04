import type { MetricCandidate } from './metric-extraction.schemas.js';
import {
  evidenceAppearsInEntryText,
  evidenceWordOverlapRatio,
} from '../profile-facts/profile-fact-deduplication.js';

const SLEEP_SUBJECT_PATTERN =
  /(?:night_sleep|sleep_quality|sleep_duration|сон|спав|недосип|проснув)/i;

const GENERIC_KEY_PARTS = new Set([
  'occurred',
  'consumed',
  'level',
  'quality',
  'duration',
  'minutes',
  'day',
  'night',
  'morning',
  'evening',
  'acute',
  'daily',
]);

function normalizeSubjectText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function subjectHints(
  candidate: MetricCandidate,
  knownTitle?: string,
  knownAliases: string[] = [],
): string[] {
  const fromKey = candidate.candidate_key
    .split('_')
    .filter((part) => part.length >= 3 && !GENERIC_KEY_PARTS.has(part));
  return [
    ...fromKey,
    candidate.title,
    knownTitle ?? '',
    ...knownAliases,
  ]
    .map((hint) => normalizeSubjectText(hint))
    .filter(Boolean);
}

function metricSubjectMentionedInEntry(
  candidate: MetricCandidate,
  entryText: string,
  knownTitle?: string,
  knownAliases: string[] = [],
): boolean {
  const haystack = normalizeSubjectText(entryText);
  for (const hint of subjectHints(candidate, knownTitle, knownAliases)) {
    if (hint.length >= 4 && haystack.includes(hint)) {
      return true;
    }
    for (const word of hint.split(/\s+/)) {
      if (word.length >= 4 && haystack.includes(word)) {
        return true;
      }
    }
    if (hint.length >= 5 && haystack.includes(hint.slice(0, 5))) {
      return true;
    }
  }
  return false;
}

function isWholeEntryEvidencePassthrough(evidenceText: string, entryText: string): boolean {
  const evidence = normalizeSubjectText(evidenceText);
  const entry = normalizeSubjectText(entryText);
  if (!evidence || !entry) {
    return false;
  }
  if (evidence === entry) {
    return true;
  }
  return evidence.length >= entry.length * 0.85 && entry.startsWith(evidence.slice(0, Math.min(24, evidence.length)));
}

const ENERGY_KEY_PATTERN = /(?:acute_energy|energy_level|energy)/i;
const ENERGY_SUBJECT_PATTERN = /(?:енерг|energy|втом|fatigue|бодр)/i;

/** Reject clear hallucinations (e.g. sleep metric when entry never mentions sleep). */
export function isLikelyHallucinatedMetric(candidate: MetricCandidate, entryText: string): boolean {
  const key = candidate.candidate_key.toLowerCase();
  const haystack = `${entryText}\n${candidate.evidence_text}`;

  const mentionsSleep =
    /(?:night_sleep|sleep_quality|sleep_duration)/.test(key) ||
    /(?:sleep|сон)/i.test(candidate.title);

  if (mentionsSleep && !SLEEP_SUBJECT_PATTERN.test(haystack)) {
    return true;
  }

  const mentionsEnergy = ENERGY_KEY_PATTERN.test(key) || /energy/i.test(candidate.title);
  if (mentionsEnergy && !ENERGY_SUBJECT_PATTERN.test(haystack)) {
    if (/(?:тривож|стрес|anxiety|stress|тревог)/i.test(haystack)) {
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Lightweight plausibility check — trust LLM evidence; reject hallucinations and lazy whole-entry passthrough.
 */
export function isMetricGroundedInEntryText(
  candidate: MetricCandidate,
  entryText: string,
  knownTitle?: string,
  knownAliases: string[] = [],
): boolean {
  if (isLikelyHallucinatedMetric(candidate, entryText)) {
    return false;
  }

  const evidenceGrounded =
    evidenceAppearsInEntryText(candidate.evidence_text, entryText) ||
    evidenceWordOverlapRatio(candidate.evidence_text, entryText) >= 0.55;

  if (!evidenceGrounded) {
    return false;
  }

  if (
    isWholeEntryEvidencePassthrough(candidate.evidence_text, entryText) &&
    !metricSubjectMentionedInEntry(candidate, entryText, knownTitle, knownAliases) &&
    !stressSubjectMentionedInEntry(candidate, entryText)
  ) {
    return false;
  }

  return true;
}

function stressSubjectMentionedInEntry(candidate: MetricCandidate, entryText: string): boolean {
  if (!/(?:stress|anxiety|тривож|стрес)/i.test(`${candidate.candidate_key} ${candidate.title}`)) {
    return false;
  }
  return /(?:тривож|стрес|anxiety|stress|тревог)/i.test(entryText);
}
