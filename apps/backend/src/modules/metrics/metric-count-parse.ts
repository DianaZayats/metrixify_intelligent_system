import { evidenceClauseInEntry } from './metric-rating-parse.js';

const COUNT_WORDS: Record<string, number> = {
  one: 1,
  a: 1,
  an: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  один: 1,
  одна: 1,
  одну: 1,
  два: 2,
  дві: 2,
  две: 2,
  три: 3,
  чотири: 4,
  пять: 5,
};

const CAFFEINE_KEY = /(?:caffeine|coffee|кав|кофе)/i;

const COFFEE_CUP_PATTERN =
  /(\d+(?:[.,]\d+)?|одна|один|одну|два|дві|две|три|чотири|п(?:'|’)ять|one|two|three)\s*(?:чашк(?:а|и|у|ами)?|cup(?:s)?)/i;

function parseCountToken(raw: string): number | null {
  const normalized = raw.trim().toLowerCase();
  if (COUNT_WORDS[normalized] !== undefined) {
    return COUNT_WORDS[normalized];
  }
  const numeric = Number(normalized.replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : null;
}

function isCaffeineCandidate(candidate: {
  candidate_key: string;
  title: string;
  evidence_text: string;
}): boolean {
  const haystack = `${candidate.candidate_key} ${candidate.title} ${candidate.evidence_text}`;
  return CAFFEINE_KEY.test(haystack);
}

/** Parse explicit cup counts (e.g. «кава одна чашка») — never reuse symptom X/10 ratings. */
export function applyExplicitCountFromEntryText<T extends {
  candidate_key: string;
  title: string;
  value_type: string;
  value_number: number | null;
  evidence_text: string;
  confidence: number;
}>(candidate: T, entryText: string): T {
  if (candidate.value_type !== 'number' || !isCaffeineCandidate(candidate)) {
    return candidate;
  }

  const clause = evidenceClauseInEntry(candidate.evidence_text, entryText);
  const match = clause.match(COFFEE_CUP_PATTERN) ?? candidate.evidence_text.match(COFFEE_CUP_PATTERN);
  if (!match?.[1]) {
    return candidate;
  }

  const count = parseCountToken(match[1]);
  if (count === null || count < 0) {
    return candidate;
  }

  return {
    ...candidate,
    value_number: count,
    confidence: Math.max(candidate.confidence, 0.93),
  };
}
