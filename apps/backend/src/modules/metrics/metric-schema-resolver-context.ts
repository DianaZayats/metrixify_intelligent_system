import type { DiaryEntry, MetricDefinition, MetricObservation } from '@prisma/client';
import { parseAliasesJson, parseTagsJson } from './metric-normalization.js';
import { formatObservationValue } from './metric.mapper.js';
import type { MetricSimilarityMatch } from './metric-schema-matching.js';
import type { SchemaResolverContextPack } from './metric-schema-resolver.schemas.js';

export function buildSchemaResolverContextPack(params: {
  entry: DiaryEntry;
  observations: Array<MetricObservation & { metricDefinition: MetricDefinition }>;
  candidateMatches: Map<string, MetricSimilarityMatch[]>;
}): SchemaResolverContextPack {
  const candidateMetrics = new Map<string, SchemaResolverContextPack['candidate_metrics'][number]>();

  for (const matches of params.candidateMatches.values()) {
    for (const match of matches) {
      if (candidateMetrics.has(match.definition.id)) {
        continue;
      }
      candidateMetrics.set(match.definition.id, {
        id: match.definition.id,
        key: match.definition.key,
        title: match.definition.title,
        value_type: match.definition.valueType,
        aliases: parseAliasesJson(match.definition.aliasesJson),
        tags: parseTagsJson(match.definition.tagsJson),
        description: match.definition.description,
        similarity_score: match.score,
      });
    }
  }

  return {
    schema_version: '1',
    entry: {
      id: params.entry.id,
      entry_date: params.entry.entryDate.toISOString().slice(0, 10),
      summary: params.entry.summaryText,
    },
    observations: params.observations.map((observation) => ({
      id: observation.id,
      metric_definition_id: observation.metricDefinitionId,
      metric_key: observation.metricDefinition.key,
      metric_title: observation.metricDefinition.title,
      value_type: observation.metricDefinition.valueType,
      value_display: formatObservationValue(observation),
      evidence_text: observation.evidenceText,
      confidence: observation.confidence,
    })),
    candidate_metrics: [...candidateMetrics.values()],
  };
}
