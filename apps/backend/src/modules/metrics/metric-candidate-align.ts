import type { MetricDefinition } from '@prisma/client';
import type { MetricCandidate } from './metric-extraction.schemas.js';
import { rescaleOrdinalValue } from './metric-rating-parse.js';

/** Align ordinal value to an existing metric definition scale (rescale, never drop). */
export function alignCandidateToDefinition(
  candidate: MetricCandidate,
  definition: Pick<MetricDefinition, 'valueType' | 'scaleMin' | 'scaleMax'> | null,
): MetricCandidate {
  if (candidate.value_type !== 'ordinal' || candidate.value_number === null) {
    return candidate;
  }

  const targetMin = definition?.scaleMin ?? candidate.scale_min ?? 1;
  const targetMax = definition?.scaleMax ?? candidate.scale_max ?? 5;
  const value = candidate.value_number;

  if (value >= targetMin && value <= targetMax) {
    return { ...candidate, scale_min: targetMin, scale_max: targetMax };
  }

  const sourceMax = candidate.scale_max ?? (value <= 10 ? 10 : targetMax);
  const sourceMin = candidate.scale_min ?? (sourceMax === 10 ? 0 : 1);
  const rescaled = rescaleOrdinalValue({
    value,
    sourceScaleMin: sourceMin,
    sourceScaleMax: sourceMax,
    targetScaleMin: targetMin,
    targetScaleMax: targetMax,
  });

  return {
    ...candidate,
    value_number: rescaled,
    scale_min: targetMin,
    scale_max: targetMax,
  };
}

/** Clamp ordinal into scale when rescale source is unknown. */
export function clampOrdinalToScale(candidate: MetricCandidate): MetricCandidate {
  if (candidate.value_type !== 'ordinal' || candidate.value_number === null) {
    return candidate;
  }

  const min = candidate.scale_min ?? 1;
  const max = candidate.scale_max ?? 5;
  const clamped = Math.max(min, Math.min(max, candidate.value_number));

  return { ...candidate, value_number: clamped, scale_min: min, scale_max: max };
}
