import type { MetricValueType } from '@metrixify/shared-types';
import type { MetricCandidate } from './metric-extraction.schemas.js';

export function normalizeMetricKey(candidateKey: string): string {
  return candidateKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

export type NormalizedObservationValue = {
  valueNumber: number | null;
  valueText: string | null;
  valueBoolean: boolean | null;
};

export function normalizeObservationValue(
  candidate: MetricCandidate,
): NormalizedObservationValue {
  switch (candidate.value_type) {
    case 'number':
    case 'ordinal':
      return {
        valueNumber: candidate.value_number ?? null,
        valueText: null,
        valueBoolean: null,
      };
    case 'boolean':
      return {
        valueNumber: null,
        valueText: null,
        valueBoolean: candidate.value_boolean ?? null,
      };
    case 'category':
      return {
        valueNumber: null,
        valueText: candidate.value_text ?? null,
        valueBoolean: null,
      };
    default: {
      const _exhaustive: never = candidate.value_type;
      return _exhaustive;
    }
  }
}

export function assertCandidateHasValue(
  candidate: MetricCandidate,
  normalized: NormalizedObservationValue,
): void {
  const hasValue =
    normalized.valueNumber !== null ||
    normalized.valueText !== null ||
    normalized.valueBoolean !== null;

  if (!hasValue) {
    throw new Error(`Metric candidate "${candidate.candidate_key}" has no value`);
  }
}

export function parseAliasesJson(aliasesJson: unknown): string[] {
  if (!Array.isArray(aliasesJson)) {
    return [];
  }
  return aliasesJson.filter((item): item is string => typeof item === 'string');
}

export function normalizeMetricTag(tag: string): string {
  return tag
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

export function parseTagsJson(tagsJson: unknown): string[] {
  if (!Array.isArray(tagsJson)) {
    return [];
  }
  return tagsJson.filter((item): item is string => typeof item === 'string');
}

export function uniqueMetricTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of tags) {
    const normalized = normalizeMetricTag(tag);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= 10) {
      break;
    }
  }

  return result;
}
