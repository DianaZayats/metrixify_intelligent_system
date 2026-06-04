import type { MetricDefinition, MetricObservation, MetricValueType, Prisma } from '@prisma/client';
import { prisma } from '../../shared/db/prisma.js';
import type { MetricCandidate } from './metric-extraction.schemas.js';
import { ensureCandidateI18n, mergeLocalizedString, mergeTagsI18n } from './metric-i18n.js';
import { normalizeMetricKey, parseAliasesJson, parseTagsJson, uniqueMetricTags } from './metric-normalization.js';
import { parseLocalizedString, parseTagsI18nMap } from '@metrixify/shared-types';

export async function findMetricDefinitionByKey(
  userId: string,
  key: string,
): Promise<MetricDefinition | null> {
  return prisma.metricDefinition.findFirst({
    where: { userId, key, status: 'active' },
  });
}

/** Lookup by @@unique([userId, key]) regardless of status — for upsert/reactivate paths. */
export async function findMetricDefinitionByKeyAnyStatus(
  userId: string,
  key: string,
): Promise<MetricDefinition | null> {
  return prisma.metricDefinition.findUnique({
    where: { userId_key: { userId, key } },
  });
}

/**
 * Resolve active definition for a candidate key: reactivate archived row or create new.
 * Avoids unique constraint violations when an archived definition still owns the key.
 */
export async function ensureMetricDefinitionForCandidate(params: {
  userId: string;
  entryId: string;
  candidate: MetricCandidate;
  key: string;
}): Promise<MetricDefinition> {
  const existing = await findMetricDefinitionByKeyAnyStatus(params.userId, params.key);
  const enriched = ensureCandidateI18n(params.candidate);

  if (existing) {
    if (existing.status === 'archived') {
      await prisma.metricDefinition.update({
        where: { id: existing.id },
        data: {
          status: 'active',
          version: { increment: 1 },
        },
      });
    }
    return syncDefinitionDisplayFromCandidate(existing.id, enriched);
  }

  return createMetricDefinitionFromCandidate(params);
}

export async function findMetricObservationByIdForUser(
  id: string,
  userId: string,
): Promise<(MetricObservation & { metricDefinition: MetricDefinition }) | null> {
  return prisma.metricObservation.findFirst({
    where: { id, userId },
    include: { metricDefinition: true },
  });
}

export async function updateMetricObservationForUser(params: {
  id: string;
  userId: string;
  valueNumber?: number | null;
  valueText?: string | null;
  valueBoolean?: boolean | null;
  observedAt?: Date;
  evidenceText?: string | null;
  metadataJson?: Prisma.InputJsonValue;
}): Promise<MetricObservation> {
  const data: Prisma.MetricObservationUpdateInput = {
    source: 'manual',
  };

  if (params.valueNumber !== undefined) {
    data.valueNumber = params.valueNumber;
  }
  if (params.valueText !== undefined) {
    data.valueText = params.valueText;
  }
  if (params.valueBoolean !== undefined) {
    data.valueBoolean = params.valueBoolean;
  }
  if (params.observedAt !== undefined) {
    data.observedAt = params.observedAt;
  }
  if (params.evidenceText !== undefined) {
    data.evidenceText = params.evidenceText;
  }
  if (params.metadataJson !== undefined) {
    data.metadataJson = params.metadataJson;
  }

  return prisma.metricObservation.update({
    where: { id: params.id },
    data,
  });
}

export async function deleteMetricObservationForUser(id: string, userId: string): Promise<void> {
  await prisma.metricObservation.deleteMany({
    where: { id, userId },
  });
}

export async function appendDiaryEntryCorrectionAudit(params: {
  entryId: string;
  userId: string;
  metadataJson: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.diaryEntry.updateMany({
    where: { id: params.entryId, userId: params.userId },
    data: { metadataJson: params.metadataJson },
  });
}

export async function createMetricDefinitionFromCandidate(params: {
  userId: string;
  entryId: string;
  candidate: MetricCandidate;
  key: string;
}): Promise<MetricDefinition> {
  const { candidate, key, userId, entryId } = params;
  const enriched = ensureCandidateI18n(candidate);

  return prisma.metricDefinition.create({
    data: {
      userId,
      key,
      title: enriched.title.trim(),
      titleI18n: enriched.title_i18n,
      description: null,
      descriptionI18n: null,
      valueType: enriched.value_type as MetricValueType,
      unit: enriched.unit ?? null,
      scaleMin: enriched.scale_min ?? null,
      scaleMax: enriched.scale_max ?? null,
      aliasesJson: [enriched.title.trim()],
      tagsJson: uniqueMetricTags(enriched.tags),
      tagsI18n: enriched.tags_i18n,
      createdFromEntryId: entryId,
      confidence: enriched.confidence,
    },
  });
}

export type CreateObservationInput = {
  userId: string;
  entryId: string;
  metricDefinitionId: string;
  observedAt: Date;
  valueNumber: number | null;
  valueText: string | null;
  valueBoolean: boolean | null;
  confidence: number;
  evidenceText: string;
  metadataJson?: Prisma.InputJsonValue;
  source?: 'ai' | 'manual';
};

export async function createMetricObservation(
  input: CreateObservationInput,
): Promise<MetricObservation> {
  return prisma.metricObservation.create({
    data: {
      userId: input.userId,
      entryId: input.entryId,
      metricDefinitionId: input.metricDefinitionId,
      observedAt: input.observedAt,
      valueNumber: input.valueNumber,
      valueText: input.valueText,
      valueBoolean: input.valueBoolean,
      confidence: input.confidence,
      evidenceText: input.evidenceText,
      metadataJson: input.metadataJson,
      source: input.source ?? 'ai',
    },
  });
}

export async function listObservationsByEntry(
  entryId: string,
  userId: string,
): Promise<(MetricObservation & { metricDefinition: MetricDefinition })[]> {
  return prisma.metricObservation.findMany({
    where: { entryId, userId },
    include: { metricDefinition: true },
    orderBy: { observedAt: 'asc' },
  });
}

export async function listObservationsForUser(
  userId: string,
  params?: { metricDefinitionId?: string; limit?: number },
): Promise<(MetricObservation & { metricDefinition: MetricDefinition })[]> {
  return prisma.metricObservation.findMany({
    where: {
      userId,
      ...(params?.metricDefinitionId
        ? { metricDefinitionId: params.metricDefinitionId }
        : {}),
    },
    include: { metricDefinition: true },
    orderBy: [{ observedAt: 'desc' }, { createdAt: 'desc' }],
    take: params?.limit ?? 500,
  });
}

export async function listMetricDefinitionsWithStats(userId: string): Promise<
  Array<
    MetricDefinition & {
      observationCount: number;
      lastObservedAt: Date | null;
    }
  >
> {
  const definitions = await prisma.metricDefinition.findMany({
    where: { userId },
    orderBy: [{ status: 'asc' }, { title: 'asc' }],
  });

  if (definitions.length === 0) {
    return [];
  }

  const stats = await prisma.metricObservation.groupBy({
    by: ['metricDefinitionId'],
    where: { userId },
    _count: { id: true },
    _max: { observedAt: true },
  });

  const statsById = new Map(
    stats.map((row) => [
      row.metricDefinitionId,
      { count: row._count.id, lastObservedAt: row._max.observedAt },
    ]),
  );

  return definitions.map((definition) => {
    const stat = statsById.get(definition.id);
    return {
      ...definition,
      observationCount: stat?.count ?? 0,
      lastObservedAt: stat?.lastObservedAt ?? null,
    };
  });
}

export async function findMetricDefinitionByIdForUser(
  id: string,
  userId: string,
): Promise<MetricDefinition | null> {
  return prisma.metricDefinition.findFirst({
    where: { id, userId },
  });
}

export async function hasValidMetricExtractionRun(entryId: string): Promise<boolean> {
  const run = await prisma.aiRun.findFirst({
    where: {
      entryId,
      runType: 'metric_extraction',
      validationStatus: 'valid',
    },
    select: { id: true },
  });
  return Boolean(run);
}

export function resolveMetricKey(candidate: MetricCandidate): string {
  const key = normalizeMetricKey(candidate.candidate_key);
  if (!key) {
    throw new Error(`Invalid candidate_key: ${candidate.candidate_key}`);
  }
  return key;
}

export async function listActiveMetricDefinitions(userId: string): Promise<MetricDefinition[]> {
  return prisma.metricDefinition.findMany({
    where: { userId, status: 'active' },
    orderBy: { title: 'asc' },
  });
}

export async function countObservationsForDefinition(metricDefinitionId: string): Promise<number> {
  return prisma.metricObservation.count({
    where: { metricDefinitionId },
  });
}

export async function reassignObservationToDefinition(params: {
  observationId: string;
  userId: string;
  targetMetricDefinitionId: string;
}): Promise<MetricObservation> {
  const observation = await prisma.metricObservation.findFirst({
    where: { id: params.observationId, userId: params.userId },
  });
  if (!observation) {
    throw new Error('Observation not found');
  }

  return prisma.metricObservation.update({
    where: { id: observation.id },
    data: { metricDefinitionId: params.targetMetricDefinitionId },
  });
}

function uniqueAliases(existing: string[], additions: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of [...existing, ...additions]) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(trimmed);
  }

  return result;
}

export async function syncDefinitionDisplayFromCandidate(
  metricDefinitionId: string,
  candidate: MetricCandidate,
): Promise<MetricDefinition> {
  const definition = await prisma.metricDefinition.findUnique({
    where: { id: metricDefinitionId },
  });
  if (!definition) {
    throw new Error('Metric definition not found');
  }

  const enriched = ensureCandidateI18n(candidate);
  const mergedTags = uniqueMetricTags([...parseTagsJson(definition.tagsJson), ...enriched.tags]);
  const mergedTagsI18n = mergeTagsI18n(parseTagsI18nMap(definition.tagsI18n), enriched.tags_i18n);
  const titleI18n = mergeLocalizedString(
    parseLocalizedString(definition.titleI18n),
    enriched.title_i18n,
  );

  return prisma.metricDefinition.update({
    where: { id: metricDefinitionId },
    data: {
      title: titleI18n.en.trim(),
      titleI18n,
      tagsJson: mergedTags,
      tagsI18n: mergedTagsI18n,
      version: { increment: 1 },
    },
  });
}

export async function addTagsToDefinition(
  metricDefinitionId: string,
  tagsToAdd: string[],
  tagsI18nToAdd?: Record<string, { en: string; uk?: string }>,
): Promise<MetricDefinition> {
  const definition = await prisma.metricDefinition.findUnique({
    where: { id: metricDefinitionId },
  });
  if (!definition) {
    throw new Error('Metric definition not found');
  }

  const current = parseTagsJson(definition.tagsJson);
  const merged = uniqueMetricTags([...current, ...tagsToAdd]);
  const mergedI18n = mergeTagsI18n(
    definition.tagsI18n as Record<string, { en: string; uk?: string }> | null,
    tagsI18nToAdd ?? {},
  );

  return prisma.metricDefinition.update({
    where: { id: metricDefinitionId },
    data: {
      tagsJson: merged,
      tagsI18n: mergedI18n,
      version: { increment: 1 },
    },
  });
}

export async function addAliasesToDefinition(
  metricDefinitionId: string,
  aliasesToAdd: string[],
): Promise<MetricDefinition> {
  const definition = await prisma.metricDefinition.findUnique({
    where: { id: metricDefinitionId },
  });
  if (!definition) {
    throw new Error('Metric definition not found');
  }

  const current = parseAliasesJson(definition.aliasesJson);
  const merged = uniqueAliases(current, aliasesToAdd);

  return prisma.metricDefinition.update({
    where: { id: metricDefinitionId },
    data: {
      aliasesJson: merged,
      version: { increment: 1 },
    },
  });
}

export async function updateMetricDefinitionForUser(params: {
  id: string;
  userId: string;
  title?: string;
  description?: string | null;
  aliases?: string[];
  tags?: string[];
}): Promise<MetricDefinition> {
  const definition = await findMetricDefinitionByIdForUser(params.id, params.userId);
  if (!definition) {
    throw new Error('Metric definition not found');
  }

  const data: Prisma.MetricDefinitionUpdateInput = {
    version: { increment: 1 },
  };

  if (params.title !== undefined) {
    data.title = params.title.trim();
  }
  if (params.description !== undefined) {
    data.description = params.description;
  }
  if (params.aliases !== undefined) {
    data.aliasesJson = uniqueAliases([], params.aliases);
  }
  if (params.tags !== undefined) {
    data.tagsJson = uniqueMetricTags(params.tags);
  }

  return prisma.metricDefinition.update({
    where: { id: definition.id },
    data,
  });
}

export async function archiveMetricDefinitionForUser(
  id: string,
  userId: string,
): Promise<MetricDefinition> {
  const definition = await findMetricDefinitionByIdForUser(id, userId);
  if (!definition) {
    throw new Error('Metric definition not found');
  }

  return prisma.metricDefinition.update({
    where: { id: definition.id },
    data: {
      status: 'archived',
      version: { increment: 1 },
    },
  });
}

export async function archiveEmptyDefinitionsFromEntry(params: {
  userId: string;
  entryId: string;
}): Promise<number> {
  const definitions = await prisma.metricDefinition.findMany({
    where: {
      userId: params.userId,
      createdFromEntryId: params.entryId,
      status: 'active',
    },
  });

  let archived = 0;
  for (const definition of definitions) {
    const count = await countObservationsForDefinition(definition.id);
    if (count === 0) {
      await prisma.metricDefinition.update({
        where: { id: definition.id },
        data: { status: 'archived', version: { increment: 1 } },
      });
      archived += 1;
    }
  }

  return archived;
}

export async function hasValidSchemaResolverRun(entryId: string): Promise<boolean> {
  const run = await prisma.aiRun.findFirst({
    where: {
      entryId,
      runType: 'schema_resolver',
      validationStatus: 'valid',
    },
    select: { id: true },
  });
  return Boolean(run);
}
