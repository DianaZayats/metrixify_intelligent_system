/** UI label: repeated high-confidence evidence vs single or weaker signal. */
export const PROFILE_FACT_RELIABILITY_LEVELS = ['likely_fact', 'hypothesis'] as const;
export type ProfileFactReliability = (typeof PROFILE_FACT_RELIABILITY_LEVELS)[number];

/** Minimum model confidence to treat a fact as "likely" (persist threshold is 0.7). */
export const PROFILE_FACT_LIKELY_MIN_CONFIDENCE = 0.85;

/** Minimum distinct diary mentions (evidence rows) for "likely fact". */
export const PROFILE_FACT_LIKELY_MIN_EVIDENCE = 2;

export function classifyProfileFactReliability(
  confidence: number | null,
  evidenceCount: number,
): ProfileFactReliability {
  if (
    confidence !== null &&
    confidence >= PROFILE_FACT_LIKELY_MIN_CONFIDENCE &&
    evidenceCount >= PROFILE_FACT_LIKELY_MIN_EVIDENCE
  ) {
    return 'likely_fact';
  }
  return 'hypothesis';
}
