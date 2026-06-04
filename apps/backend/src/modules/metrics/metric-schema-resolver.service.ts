import { getConfig } from '@metrixify/config';
import { jsonContextPackToToon } from '@metrixify/llm-payload-codec';
import type { DiaryEntry, MetricDefinition } from '@prisma/client';
import { loadMetricSchemaResolverPrompt } from '../../ai/prompt-loader.js';
import { prisma } from '../../shared/db/prisma.js';
import { createOpenAiStructuredChatClient } from '../ai-gateway/openai-chat.client.js';
import type { StructuredChatClient } from '../ai-gateway/openai-chat.client.js';
import {
  findDiaryEntryById,
  markEntrySchemaResolveFailed,
  markEntrySchemaResolveSuccess,
} from '../entries/entry.repository.js';
import { parseTagsJson, normalizeMetricKey } from './metric-normalization.js';
import {
  collectDefinitionLabels,
  findDefinitionByExactLabel,
  findSimilarMetricDefinitions,
  isDeterministicAutoLink,
} from './metric-schema-matching.js';
import { SCHEMA_RESOLVE_THRESHOLDS } from './metric-schema-resolver.config.js';
import { buildSchemaResolverContextPack } from './metric-schema-resolver-context.js';
import type { SchemaResolverDecision } from './metric-schema-resolver.schemas.js';
import { schemaResolverOutputSchema } from './metric-schema-resolver.schemas.js';
import {
  addAliasesToDefinition,
  addTagsToDefinition,
  archiveEmptyDefinitionsFromEntry,
  hasValidSchemaResolverRun,
  listActiveMetricDefinitions,
  listObservationsByEntry,
  reassignObservationToDefinition,
} from './metric.repository.js';

const POST_SCHEMA_RESOLVE_STATUSES: DiaryEntry['processingStatus'][] = [
  'extracting_facts',
  'saving_results',
  'completed',
];

export type ResolveSchemaInput = {
  entryId: string;
  userId: string;
};

export type SchemaResolverDeps = {
  chat: StructuredChatClient;
};

export function createDefaultSchemaResolverDeps(): SchemaResolverDeps {
  return {
    chat: createOpenAiStructuredChatClient(),
  };
}

type PendingLlmObservation = {
  observationId: string;
  currentDefinition: MetricDefinition;
};

async function logSchemaResolverRun(params: {
  userId: string;
  entryId: string;
  model: string;
  promptVersion: string;
  inputSnapshot: Record<string, unknown>;
  outputSnapshot?: Record<string, unknown>;
  errorJson?: Record<string, unknown>;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}): Promise<void> {
  await prisma.aiRun.create({
    data: {
      userId: params.userId,
      entryId: params.entryId,
      runType: 'schema_resolver',
      model: params.model,
      promptVersion: params.promptVersion,
      inputFormat: 'toon',
      inputSnapshot: params.inputSnapshot,
      outputSnapshot: params.outputSnapshot,
      validationStatus: params.errorJson ? 'invalid' : 'valid',
      errorJson: params.errorJson,
      tokenUsageJson: params.tokenUsage,
    },
  });
}

async function linkObservationToDefinition(params: {
  userId: string;
  observationId: string;
  sourceDefinition: MetricDefinition;
  targetDefinition: MetricDefinition;
  aliasesToAdd?: string[];
}): Promise<void> {
  await reassignObservationToDefinition({
    observationId: params.observationId,
    userId: params.userId,
    targetMetricDefinitionId: params.targetDefinition.id,
  });

  const aliases = uniqueAliasCandidates(
    params.sourceDefinition,
    params.targetDefinition,
    params.aliasesToAdd,
  ).filter(
    (alias) => normalizeMetricKey(alias) !== normalizeMetricKey(params.targetDefinition.key),
  );
  if (aliases.length > 0) {
    await addAliasesToDefinition(params.targetDefinition.id, aliases);
  }

  const sourceTags = parseTagsJson(params.sourceDefinition.tagsJson);
  if (sourceTags.length > 0) {
    await addTagsToDefinition(params.targetDefinition.id, sourceTags);
  }
}

function uniqueAliasCandidates(
  sourceDefinition: MetricDefinition,
  targetDefinition: MetricDefinition,
  extraAliases: string[] = [],
): string[] {
  const existing = new Set(
    collectDefinitionLabels(targetDefinition).map((label) => label.toLowerCase()),
  );
  const candidates = [...collectDefinitionLabels(sourceDefinition), ...extraAliases];

  return candidates.filter((label) => {
    const trimmed = label.trim();
    return trimmed.length > 0 && !existing.has(trimmed.toLowerCase());
  });
}

function aliasesForLink(
  sourceDefinition: MetricDefinition,
  aliasToAdd: string | null | undefined,
): string[] {
  const aliases = collectDefinitionLabels(sourceDefinition);
  if (aliasToAdd?.trim()) {
    aliases.push(aliasToAdd.trim());
  }
  return aliases;
}

function isAllowedTarget(
  targetMetricId: string | null | undefined,
  allowedIds: Set<string>,
): targetMetricId is string {
  return Boolean(targetMetricId && allowedIds.has(targetMetricId));
}

async function applyLlmDecision(params: {
  userId: string;
  decision: SchemaResolverDecision;
  observationById: Map<string, { metricDefinition: MetricDefinition }>;
  allowedTargetIds: Set<string>;
  applyMinConfidence: number;
}): Promise<boolean> {
  const observation = params.observationById.get(params.decision.observation_id);
  if (!observation) {
    return false;
  }

  if (params.decision.confidence < params.applyMinConfidence) {
    return false;
  }

  const currentDefinition = observation.metricDefinition;

  if (params.decision.action === 'keep_new') {
    return true;
  }

  if (params.decision.action === 'add_alias') {
    const alias = params.decision.alias_to_add?.trim();
    if (alias) {
      await addAliasesToDefinition(currentDefinition.id, [alias]);
    }
    return true;
  }

  if (
    params.decision.action === 'link_existing' &&
    isAllowedTarget(params.decision.target_metric_id, params.allowedTargetIds)
  ) {
    const target = await prisma.metricDefinition.findFirst({
      where: {
        id: params.decision.target_metric_id,
        userId: params.userId,
        status: 'active',
      },
    });
    if (!target || target.valueType !== currentDefinition.valueType) {
      return false;
    }

    await linkObservationToDefinition({
      userId: params.userId,
      observationId: params.decision.observation_id,
      sourceDefinition: currentDefinition,
      targetDefinition: target,
      aliasesToAdd: aliasesForLink(currentDefinition, params.decision.alias_to_add),
    });
    return true;
  }

  return false;
}

export async function resolveSchemaForEntry(
  input: ResolveSchemaInput,
  deps: SchemaResolverDeps = createDefaultSchemaResolverDeps(),
): Promise<{ linkedCount: number; skipped: boolean }> {
  const entry = await findDiaryEntryById(input.entryId, input.userId);
  if (!entry) {
    throw new Error('Entry not found');
  }

  if (POST_SCHEMA_RESOLVE_STATUSES.includes(entry.processingStatus)) {
    return { linkedCount: 0, skipped: true };
  }

  if (await hasValidSchemaResolverRun(entry.id)) {
    return { linkedCount: 0, skipped: true };
  }

  if (entry.processingStatus !== 'resolving_schema') {
    return { linkedCount: 0, skipped: true };
  }

  const observations = await listObservationsByEntry(entry.id, input.userId);
  const activeDefinitions = await listActiveMetricDefinitions(input.userId);
  let linkedCount = 0;
  const pendingLlm: PendingLlmObservation[] = [];
  const candidateMatches = new Map<string, ReturnType<typeof findSimilarMetricDefinitions>>();

  for (const observation of observations) {
    const currentDefinition = observation.metricDefinition;
    const otherDefinitions = activeDefinitions.filter((item) => item.id !== currentDefinition.id);
    let linked = false;

    const candidateKey = normalizeMetricKey(
      String((observation.metadataJson as { candidateKey?: string } | null)?.candidateKey ?? ''),
    );
    if (candidateKey && candidateKey === normalizeMetricKey(currentDefinition.key)) {
      continue;
    }

    const duplicateByKey = otherDefinitions.find(
      (item) => normalizeMetricKey(item.key) === normalizeMetricKey(currentDefinition.key),
    );
    if (duplicateByKey) {
      await linkObservationToDefinition({
        userId: input.userId,
        observationId: observation.id,
        sourceDefinition: currentDefinition,
        targetDefinition: duplicateByKey,
      });
      linkedCount += 1;
      continue;
    }

    for (const label of collectDefinitionLabels(currentDefinition)) {
      if (normalizeMetricKey(label) === normalizeMetricKey(currentDefinition.key)) {
        continue;
      }

      const aliasMatch = findDefinitionByExactLabel(label, otherDefinitions, currentDefinition.id);
      if (aliasMatch) {
        await linkObservationToDefinition({
          userId: input.userId,
          observationId: observation.id,
          sourceDefinition: currentDefinition,
          targetDefinition: aliasMatch,
          aliasesToAdd: [currentDefinition.title],
        });
        linkedCount += 1;
        linked = true;
        break;
      }
    }
    if (linked) {
      continue;
    }

    const similar = findSimilarMetricDefinitions(currentDefinition, otherDefinitions);
    candidateMatches.set(observation.id, similar);

    const best = similar[0];
    if (best && isDeterministicAutoLink(best)) {
      await linkObservationToDefinition({
        userId: input.userId,
        observationId: observation.id,
        sourceDefinition: currentDefinition,
        targetDefinition: best.definition,
        aliasesToAdd: [currentDefinition.title],
      });
      linkedCount += 1;
      continue;
    }

    if (similar.length > 0) {
      pendingLlm.push({
        observationId: observation.id,
        currentDefinition,
      });
    }
  }

  const config = getConfig();
  const model = config.OPENAI_SCHEMA_RESOLVER_MODEL;
  const prompt = loadMetricSchemaResolverPrompt();
  const applyMinConfidence = config.METRIC_SCHEMA_LLM_APPLY_MIN;

  if (pendingLlm.length > 0) {
    const refreshedObservations = await listObservationsByEntry(entry.id, input.userId);
    const pendingObservations = refreshedObservations.filter((observation) =>
      pendingLlm.some(
        (item) =>
          item.observationId === observation.id &&
          item.currentDefinition.id === observation.metricDefinitionId,
      ),
    );

    const contextPack = buildSchemaResolverContextPack({
      entry,
      observations: pendingObservations,
      candidateMatches,
    });
    const toonInput = jsonContextPackToToon(contextPack);
    const inputSnapshot = { contextPack, toonInput };

    try {
      const result = await deps.chat.completeStructured({
        model,
        messages: [
          { role: 'system', content: prompt.body },
          {
            role: 'user',
            content: `Resolve metric schema for this entry. Context pack (TOON):\n\n${toonInput}`,
          },
        ],
        schema: schemaResolverOutputSchema,
        schemaName: 'metric_schema_resolver',
      });

      const observationById = new Map(
        pendingObservations.map((observation) => [observation.id, observation]),
      );
      const allowedTargetIds = new Set(contextPack.candidate_metrics.map((item) => item.id));

      for (const decision of result.data.decisions) {
        if (decision.action !== 'link_existing') {
          await applyLlmDecision({
            userId: input.userId,
            decision,
            observationById,
            allowedTargetIds,
            applyMinConfidence,
          });
          continue;
        }

        const applied = await applyLlmDecision({
          userId: input.userId,
          decision,
          observationById,
          allowedTargetIds,
          applyMinConfidence,
        });
        if (applied) {
          linkedCount += 1;
        }
      }

      await logSchemaResolverRun({
        userId: input.userId,
        entryId: entry.id,
        model: result.model,
        promptVersion: prompt.version,
        inputSnapshot,
        outputSnapshot: result.data,
        tokenUsage: result.usage,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Schema resolving failed';
      await markEntrySchemaResolveFailed(entry.id, message);
      await logSchemaResolverRun({
        userId: input.userId,
        entryId: entry.id,
        model,
        promptVersion: prompt.version,
        inputSnapshot: { pendingCount: pendingLlm.length },
        errorJson: { message },
      });
      throw error;
    }
  } else {
    await logSchemaResolverRun({
      userId: input.userId,
      entryId: entry.id,
      model: 'deterministic',
      promptVersion: prompt.version,
      inputSnapshot: {
        observationCount: observations.length,
        linkedDeterministically: linkedCount,
      },
      outputSnapshot: { decisions: [] },
    });
  }

  await archiveEmptyDefinitionsFromEntry({
    userId: input.userId,
    entryId: entry.id,
  });
  await markEntrySchemaResolveSuccess(entry.id);

  return { linkedCount, skipped: false };
}

export async function maybeResolveSchema(
  entry: DiaryEntry,
  userId: string,
  deps?: SchemaResolverDeps,
): Promise<boolean> {
  if (entry.processingStatus !== 'resolving_schema') {
    return false;
  }

  if (await hasValidSchemaResolverRun(entry.id)) {
    return false;
  }

  try {
    const result = await resolveSchemaForEntry({ entryId: entry.id, userId }, deps);
    return !result.skipped;
  } catch {
    return false;
  }
}

// Re-export thresholds for tests.
export { SCHEMA_RESOLVE_THRESHOLDS };
