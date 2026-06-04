import type { MetricDefinition, MetricValueType } from '@prisma/client';
import { normalizeMetricKey, parseAliasesJson } from './metric-normalization.js';
import { SCHEMA_RESOLVE_THRESHOLDS } from './metric-schema-resolver.config.js';

export type MetricMatchReason =
  | 'exact_key'
  | 'exact_title'
  | 'exact_alias'
  | 'semantic_similarity';

export type MetricSimilarityMatch = {
  definition: MetricDefinition;
  score: number;
  reason: MetricMatchReason;
};

export function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function tokenize(value: string): Set<string> {
  const normalized = normalizeMetricKey(value).replace(/_/g, ' ');
  return new Set(normalized.split(/\s+/).filter(Boolean));
}

export function labelSimilarityScore(left: string, right: string): number {
  const normalizedLeft = normalizeLabel(left);
  const normalizedRight = normalizeLabel(right);
  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }
  if (normalizedLeft === normalizedRight) {
    return 1;
  }
  if (normalizeMetricKey(left) === normalizeMetricKey(right)) {
    return 1;
  }

  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

export function collectDefinitionLabels(definition: MetricDefinition): string[] {
  const aliases = parseAliasesJson(definition.aliasesJson);
  return [definition.key, definition.title, ...aliases].filter(Boolean);
}

function bestLabelPairScore(sourceLabels: string[], targetLabels: string[]): number {
  let best = 0;
  for (const source of sourceLabels) {
    for (const target of targetLabels) {
      best = Math.max(best, labelSimilarityScore(source, target));
    }
  }
  return best;
}

function reasonForScore(
  source: MetricDefinition,
  target: MetricDefinition,
  score: number,
): MetricMatchReason {
  if (score < 1) {
    return 'semantic_similarity';
  }
  if (normalizeMetricKey(source.key) === normalizeMetricKey(target.key)) {
    return 'exact_key';
  }
  if (normalizeLabel(source.title) === normalizeLabel(target.title)) {
    return 'exact_title';
  }
  return 'exact_alias';
}

export function scoreMetricSimilarity(
  source: MetricDefinition,
  target: MetricDefinition,
): MetricSimilarityMatch | null {
  if (source.id === target.id) {
    return null;
  }
  if (source.valueType !== target.valueType) {
    return null;
  }

  const score = bestLabelPairScore(
    collectDefinitionLabels(source),
    collectDefinitionLabels(target),
  );
  if (score <= 0) {
    return null;
  }

  return {
    definition: target,
    score,
    reason: reasonForScore(source, target, score),
  };
}

export function findSimilarMetricDefinitions(
  source: MetricDefinition,
  candidates: MetricDefinition[],
  options: { minScore?: number; limit?: number } = {},
): MetricSimilarityMatch[] {
  const minScore = options.minScore ?? SCHEMA_RESOLVE_THRESHOLDS.semanticCandidateMin;
  const limit = options.limit ?? 5;

  return candidates
    .map((candidate) => scoreMetricSimilarity(source, candidate))
    .filter((match): match is MetricSimilarityMatch => match !== null && match.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function findDefinitionByExactLabel(
  label: string,
  definitions: MetricDefinition[],
  excludeId?: string,
): MetricDefinition | null {
  const normalizedKey = normalizeMetricKey(label);
  const normalizedLabel = normalizeLabel(label);

  for (const definition of definitions) {
    if (excludeId && definition.id === excludeId) {
      continue;
    }
    if (normalizeMetricKey(definition.key) === normalizedKey) {
      return definition;
    }
    if (normalizeLabel(definition.title) === normalizedLabel) {
      return definition;
    }
    for (const alias of parseAliasesJson(definition.aliasesJson)) {
      if (
        normalizeMetricKey(alias) === normalizedKey ||
        normalizeLabel(alias) === normalizedLabel
      ) {
        return definition;
      }
    }
  }

  return null;
}

export function isDeterministicAutoLink(match: MetricSimilarityMatch): boolean {
  return match.score >= SCHEMA_RESOLVE_THRESHOLDS.deterministicAutoLink;
}

export function valueTypesCompatible(
  left: MetricValueType,
  right: MetricValueType,
): boolean {
  return left === right;
}
