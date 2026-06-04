import { findExplicitRatings } from './metric-rating-parse.js';
import type { MetricCandidate } from './metric-extraction.schemas.js';

const INFERRED_ORDINAL_CONFIDENCE_CAP = 0.75;

export function capInferredOrdinalConfidence(
  candidate: MetricCandidate,
  entryText: string,
): MetricCandidate {
  if (candidate.value_type !== 'ordinal') {
    return candidate;
  }

  const ratings = findExplicitRatings(`${candidate.evidence_text}\n${entryText}`);
  if (ratings.length > 0) {
    return candidate;
  }

  if (candidate.confidence <= INFERRED_ORDINAL_CONFIDENCE_CAP) {
    return candidate;
  }

  return {
    ...candidate,
    confidence: INFERRED_ORDINAL_CONFIDENCE_CAP,
  };
}
