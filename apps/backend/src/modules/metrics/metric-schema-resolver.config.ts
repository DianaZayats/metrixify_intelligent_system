/** Confidence thresholds for metric schema resolving (stage 7). */
export const SCHEMA_RESOLVE_THRESHOLDS = {
  /** Auto-link without LLM when similarity score is at or above this. */
  deterministicAutoLink: 0.92,
  /** Include a definition in semantic retrieval / LLM context at or above this. */
  semanticCandidateMin: 0.45,
  /** Apply an LLM resolver decision when its confidence is at or above this. */
  llmApplyMin: 0.8,
} as const;
