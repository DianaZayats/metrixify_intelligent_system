import type { DiaryEntry } from '@prisma/client';
import { prisma } from '../../shared/db/prisma.js';
import { entryTextForProcessing } from '../summary/summary-context.js';
import { listActiveProfileFactsForUser } from '../profile-facts/profile-fact.repository.js';
import { parseValueJsonText } from '../profile-facts/profile-fact-deduplication.js';
import type { MetricExtractionContextPack } from './metric-extraction.schemas.js';
import { parseAliasesJson, parseTagsJson } from './metric-normalization.js';

export async function buildMetricExtractionContextPack(
  entry: DiaryEntry,
  userTimezone: string,
): Promise<MetricExtractionContextPack> {
  const text = entryTextForProcessing(entry);
  if (!text) {
    throw new Error('Entry has no text for metric extraction');
  }

  const existing = await prisma.metricDefinition.findMany({
    where: { userId: entry.userId, status: 'active' },
    orderBy: { title: 'asc' },
    select: {
      key: true,
      title: true,
      valueType: true,
      aliasesJson: true,
      tagsJson: true,
    },
  });

  const existingFacts = await listActiveProfileFactsForUser(entry.userId, 20);

  return {
    schema_version: '1',
    entry: {
      id: entry.id,
      entry_date: entry.entryDate.toISOString().slice(0, 10),
      recorded_at: entry.createdAt.toISOString(),
      source_type: entry.sourceType,
      text,
    },
    user: {
      timezone: userTimezone,
    },
    existing_metrics: existing.map((metric) => ({
      key: metric.key,
      title: metric.title,
      value_type: metric.valueType,
      aliases: parseAliasesJson(metric.aliasesJson),
      tags: parseTagsJson(metric.tagsJson),
    })),
    existing_profile_facts: existingFacts.map((fact) => ({
      key: fact.key,
      value_text: parseValueJsonText(fact.valueJson),
      fact_type: fact.factType,
    })),
  };
}
