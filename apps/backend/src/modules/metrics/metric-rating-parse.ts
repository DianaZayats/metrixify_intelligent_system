import { applyGenericIntensityToOrdinal } from './metric-intensity-parse.js';

/**
 * Detect explicit user-stated ratings such as "3 из 5", "7 із 10", or "3/5".
 */
export type ExplicitRating = {
  value: number;
  scaleMax: number;
  match: string;
};

const EXPLICIT_RATING_PATTERN =
  /(\d+(?:[.,]\d+)?)\s*(?:из|out of|з|із|iз)\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/gi;

function parseNumber(raw: string): number {
  return Number(raw.replace(',', '.'));
}

export function findExplicitRatings(text: string): ExplicitRating[] {
  const ratings: ExplicitRating[] = [];

  for (const match of text.matchAll(EXPLICIT_RATING_PATTERN)) {
    const valueRaw = match[1] ?? match[3];
    const scaleRaw = match[2] ?? match[4];
    if (!valueRaw || !scaleRaw) {
      continue;
    }

    const value = parseNumber(valueRaw);
    const scaleMax = parseNumber(scaleRaw);
    if (!Number.isFinite(value) || !Number.isFinite(scaleMax) || scaleMax <= 0) {
      continue;
    }

    ratings.push({
      value,
      scaleMax,
      match: match[0].trim(),
    });
  }

  return ratings;
}

/** Map a value from one closed ordinal scale to another (1-based by default). */
export function rescaleOrdinalValue(params: {
  value: number;
  sourceScaleMin?: number;
  sourceScaleMax: number;
  targetScaleMin: number;
  targetScaleMax: number;
}): number {
  const sourceMin = params.sourceScaleMin ?? 1;
  const sourceSpan = params.sourceScaleMax - sourceMin;
  const targetSpan = params.targetScaleMax - params.targetScaleMin;

  if (sourceSpan <= 0 || targetSpan <= 0) {
    return params.targetScaleMin;
  }

  const normalized = (params.value - sourceMin) / sourceSpan;
  const clamped = Math.max(0, Math.min(1, normalized));
  const scaled = params.targetScaleMin + clamped * targetSpan;
  return Math.round(scaled);
}

function pickRelevantRating(
  ratings: ExplicitRating[],
  candidate: { value_number: number | null; evidence_text: string },
  entryText: string,
): ExplicitRating | null {
  if (ratings.length === 0) {
    return null;
  }

  const scoped = ratings.filter((rating) => ratingAppliesToCandidate(rating, candidate, entryText));
  if (scoped.length === 0) {
    return null;
  }

  if (candidate.value_number !== null) {
    const valueMatch = scoped.find((rating) => rating.value === candidate.value_number);
    if (valueMatch) {
      return valueMatch;
    }
  }

  const evidenceMatch = scoped.find((rating) =>
    candidate.evidence_text.toLowerCase().includes(rating.match.toLowerCase()),
  );
  if (evidenceMatch) {
    return evidenceMatch;
  }

  const clause = evidenceClauseInEntry(candidate.evidence_text, entryText);
  const clauseRatings = scoped.filter((rating) =>
    clause.toLowerCase().includes(rating.match.toLowerCase()),
  );
  if (clauseRatings.length === 1) {
    return clauseRatings[0]!;
  }

  return null;
}

export function evidenceClauseInEntry(evidenceText: string, entryText: string): string {
  const needle = evidenceText.trim().toLowerCase().slice(0, 32);
  const idx = entryText.toLowerCase().indexOf(needle);
  if (idx < 0) {
    return evidenceText;
  }

  const before = entryText.slice(0, idx);
  const sentenceStart = Math.max(
    before.lastIndexOf('.'),
    before.lastIndexOf('!'),
    before.lastIndexOf('?'),
  );
  const start = sentenceStart >= 0 ? sentenceStart + 1 : 0;

  const after = entryText.slice(idx);
  const relativeEnd = after.search(/[.!?]/);
  const end = relativeEnd >= 0 ? idx + relativeEnd + 1 : entryText.length;

  return entryText.slice(start, end);
}

const SYMPTOM_RATING_CONTEXT =
  /(?:symptom|symptoms|симптом|дискомфорт|discomfort|severity|evening_discomfort|morning_discomfort|episode|епізод)/i;

/** Rating must appear in evidence or in the same sentence/clause as evidence — not elsewhere in the entry. */
export function ratingAppliesToCandidate(
  rating: ExplicitRating,
  candidate: { evidence_text: string },
  entryText: string,
): boolean {
  const matchLower = rating.match.toLowerCase();
  const clause = evidenceClauseInEntry(candidate.evidence_text, entryText);
  const context = `${candidate.evidence_text}\n${clause}`;

  if (rating.scaleMax > 5 && !SYMPTOM_RATING_CONTEXT.test(context)) {
    return false;
  }

  if (candidate.evidence_text.toLowerCase().includes(matchLower)) {
    return true;
  }
  return clause.toLowerCase().includes(matchLower);
}

function appendScaleNote(evidence: string, note: string): string {
  const combined = evidence.includes(note) ? evidence : `${evidence} (${note})`;
  return combined.slice(0, 500);
}

/**
 * When the entry text contains an explicit rating, prefer it over inferred ordinal values.
 * Rescales when the stated scale (e.g. /10) differs from the metric scale (e.g. 1–5).
 */
export function applyExplicitRatingFromEntryText<T extends {
  value_type: string;
  value_number: number | null;
  scale_min: number | null;
  scale_max: number | null;
  evidence_text: string;
  confidence: number;
}>(candidate: T, entryText: string): T {
  if (candidate.value_type !== 'ordinal') {
    return candidate;
  }

  const ratingsInEvidence = findExplicitRatings(candidate.evidence_text);
  const rating =
    pickRelevantRating(ratingsInEvidence, candidate, entryText) ??
    pickRelevantRating(findExplicitRatings(entryText), candidate, entryText);
  if (!rating) {
    return candidate;
  }

  const targetMin = candidate.scale_min ?? 1;
  const targetMax = candidate.scale_max ?? 5;

  if (rating.scaleMax === targetMax) {
    return {
      ...candidate,
      value_number: rating.value,
      scale_min: targetMin,
      scale_max: targetMax,
      confidence: Math.max(candidate.confidence, 0.92),
      evidence_text: appendScaleNote(candidate.evidence_text, rating.match),
    };
  }

  const rescaled = rescaleOrdinalValue({
    value: rating.value,
    sourceScaleMax: rating.scaleMax,
    targetScaleMin: targetMin,
    targetScaleMax: targetMax,
  });

  return {
    ...candidate,
    value_number: rescaled,
    scale_min: targetMin,
    scale_max: targetMax,
    confidence: Math.max(candidate.confidence, 0.92),
    evidence_text: appendScaleNote(
      candidate.evidence_text,
      `${rating.match} → ${rescaled}/${targetMax}`,
    ),
  };
}

/**
 * Ensures ordinal values fit the metric scale. Rescales from explicit X/Y when out of range.
 * Returns null when the value cannot be mapped safely.
 */
export function fitOrdinalCandidateToScale<T extends {
  value_type: string;
  value_number: number | null;
  scale_min: number | null;
  scale_max: number | null;
  evidence_text: string;
}>(candidate: T, entryText: string): T {
  if (candidate.value_type !== 'ordinal' || candidate.value_number === null) {
    return candidate;
  }

  const targetMin = candidate.scale_min ?? 1;
  const targetMax = candidate.scale_max ?? 5;
  const value = candidate.value_number;

  if (value >= targetMin && value <= targetMax) {
    return {
      ...candidate,
      scale_min: targetMin,
      scale_max: targetMax,
    };
  }

  const ratings = findExplicitRatings(`${candidate.evidence_text}\n${entryText}`);
  const rating = pickRelevantRating(ratings, candidate, entryText);

  if (rating) {
    if (rating.scaleMax === targetMax && rating.value >= targetMin && rating.value <= targetMax) {
      return {
        ...candidate,
        value_number: rating.value,
        scale_min: targetMin,
        scale_max: targetMax,
        evidence_text: appendScaleNote(candidate.evidence_text, rating.match),
      };
    }

    const rescaled = rescaleOrdinalValue({
      value: rating.value,
      sourceScaleMax: rating.scaleMax,
      targetScaleMin: targetMin,
      targetScaleMax: targetMax,
    });

    return {
      ...candidate,
      value_number: rescaled,
      scale_min: targetMin,
      scale_max: targetMax,
      evidence_text: appendScaleNote(
        candidate.evidence_text,
        `${rating.match} → ${rescaled}/${targetMax}`,
      ),
    };
  }

  // Last resort: common 1–10 diary phrasing when LLM copied the numerator only.
  if (value > targetMax && value <= 10) {
    const rescaled = rescaleOrdinalValue({
      value,
      sourceScaleMax: 10,
      targetScaleMin: targetMin,
      targetScaleMax: targetMax,
    });
    return {
      ...candidate,
      value_number: rescaled,
      scale_min: targetMin,
      scale_max: targetMax,
      evidence_text: appendScaleNote(candidate.evidence_text, `${value}/10 → ${rescaled}/${targetMax}`),
    };
  }

  return clampOrdinalToScale({
    ...candidate,
    scale_min: targetMin,
    scale_max: targetMax,
  });
}

/**
 * Map relative intensity phrases in evidence to ordinals when no explicit X/Y applies in clause.
 */
export function applyRelativeOrdinalFromEntryText<T extends {
  value_type: string;
  value_number: number | null;
  scale_min: number | null;
  scale_max: number | null;
  evidence_text: string;
  confidence: number;
}>(candidate: T, entryText: string): T {
  if (candidate.value_type !== 'ordinal') {
    return candidate;
  }

  const clause = evidenceClauseInEntry(candidate.evidence_text, entryText);
  if (findExplicitRatings(clause).length > 0) {
    return candidate;
  }

  const evidenceText = candidate.evidence_text;
  const generic = applyGenericIntensityToOrdinal(candidate, [evidenceText]);
  if (generic) {
    return generic;
  }

  return candidate;
}

function clampOrdinalToScale<T extends {
  value_type: string;
  value_number: number | null;
  scale_min: number | null;
  scale_max: number | null;
}>(candidate: T): T {
  if (candidate.value_type !== 'ordinal' || candidate.value_number === null) {
    return candidate;
  }
  const min = candidate.scale_min ?? 1;
  const max = candidate.scale_max ?? 5;
  return {
    ...candidate,
    value_number: Math.max(min, Math.min(max, candidate.value_number)),
    scale_min: min,
    scale_max: max,
  };
}
