import { getConfig } from '@metrixify/config';
import { jsonContextPackToToon } from '@metrixify/llm-payload-codec';
import type { DiaryEntry } from '@prisma/client';
import { loadMetricExtractionPrompt } from '../../ai/prompt-loader.js';
import { prisma } from '../../shared/db/prisma.js';
import { normalizeOpenAiErrorMessage } from '../../shared/lib/openai-error.js';
import { createOpenAiStructuredChatClient } from '../ai-gateway/openai-chat.client.js';
import type { StructuredChatClient } from '../ai-gateway/openai-chat.client.js';
import {
  findDiaryEntryById,
  markEntryExtractionFailed,
  markEntryExtractionSuccess,
} from '../entries/entry.repository.js';
import { buildMetricExtractionContextPack } from './metric-extraction-context.js';
import type { MetricCandidate } from './metric-extraction.schemas.js';
import { metricExtractionAiOutputSchema } from './metric-extraction.schemas.js';
import {
  assertCandidateHasValue,
  normalizeObservationValue,
  parseAliasesJson,
} from './metric-normalization.js';
import { normalizeExtractionCandidates } from './metric-candidate-normalize.js';
import { applyExplicitDurationFromEntryText } from './metric-duration-parse.js';
import { capInferredOrdinalConfidence } from './metric-inference-cap.js';
import { applyExplicitCountFromEntryText } from './metric-count-parse.js';
import {
  applyExplicitRatingFromEntryText,
  applyRelativeOrdinalFromEntryText,
  fitOrdinalCandidateToScale,
} from './metric-rating-parse.js';
import { resolveObservedAtForCandidates, recordedAtForEntryTimeline } from './metric-observed-at.js';
import { alignCandidateToDefinition } from './metric-candidate-align.js';
import { isMetricGroundedInEntryText } from './metric-extraction-grounding.js';
import { entryTextForProcessing } from '../summary/summary-context.js';
import {
  createMetricObservation,
  ensureMetricDefinitionForCandidate,
  findMetricDefinitionByKeyAnyStatus,
  hasValidMetricExtractionRun,
  resolveMetricKey,
} from './metric.repository.js';
import { ensureCandidateI18n } from './metric-i18n.js';

const POST_EXTRACTION_STATUSES: DiaryEntry['processingStatus'][] = [
  'resolving_schema',
  'extracting_facts',
  'saving_results',
  'completed',
];

export type ExtractMetricsInput = {
  entryId: string;
  userId: string;
  userTimezone: string;
};

export type ExtractionDeps = {
  chat: StructuredChatClient;
};

export function createDefaultExtractionDeps(): ExtractionDeps {
  return {
    chat: createOpenAiStructuredChatClient(),
  };
}

function postProcessCandidate(candidate: MetricCandidate, entryText: string): MetricCandidate {
  const withExplicit = applyExplicitRatingFromEntryText(candidate, entryText);
  const withRelative = applyRelativeOrdinalFromEntryText(withExplicit, entryText);
  const withCount = applyExplicitCountFromEntryText(withRelative, entryText);
  const withDuration = applyExplicitDurationFromEntryText(withCount, entryText);
  const fitted = fitOrdinalCandidateToScale(withDuration, entryText);
  return capInferredOrdinalConfidence(fitted, entryText);
}

async function persistCandidate(params: {
  userId: string;
  entry: DiaryEntry;
  candidate: MetricCandidate;
  observedAt: Date;
  observedAtPrecision: string;
}): Promise<void> {
  const { userId, entry, candidate, observedAt, observedAtPrecision } = params;
  const key = resolveMetricKey(candidate);
  let aligned = candidate;

  const existingDefinition = await findMetricDefinitionByKeyAnyStatus(userId, key);
  if (existingDefinition) {
    aligned = alignCandidateToDefinition(aligned, existingDefinition);
  }

  const normalized = normalizeObservationValue(aligned);
  assertCandidateHasValue(aligned, normalized);
  const enriched = ensureCandidateI18n(aligned);

  const definition = await ensureMetricDefinitionForCandidate({
    userId,
    entryId: entry.id,
    candidate: enriched,
    key,
  });

  const finalNormalized = normalizeObservationValue(aligned);

  await createMetricObservation({
    userId,
    entryId: entry.id,
    metricDefinitionId: definition.id,
    observedAt,
    valueNumber: finalNormalized.valueNumber,
    valueText: finalNormalized.valueText,
    valueBoolean: finalNormalized.valueBoolean,
    confidence: aligned.confidence,
    evidenceText: aligned.evidence_text.trim(),
    metadataJson: {
      candidateKey: key,
      observedAtPrecision,
      ...(aligned.narrative_order ? { narrativeOrder: aligned.narrative_order } : {}),
      ...(aligned.reasoning ? { reasoning: aligned.reasoning } : {}),
    },
  });
}

async function logExtractionRun(params: {
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
      runType: 'metric_extraction',
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

export async function extractMetricsForEntry(
  input: ExtractMetricsInput,
  deps: ExtractionDeps = createDefaultExtractionDeps(),
): Promise<{ metricCount: number; skipped: boolean }> {
  const entry = await findDiaryEntryById(input.entryId, input.userId);
  if (!entry) {
    throw new Error('Entry not found');
  }

  if (POST_EXTRACTION_STATUSES.includes(entry.processingStatus)) {
    return { metricCount: 0, skipped: true };
  }

  if (await hasValidMetricExtractionRun(entry.id)) {
    return { metricCount: 0, skipped: true };
  }

  if (entry.processingStatus !== 'extracting_metrics') {
    return { metricCount: 0, skipped: true };
  }

  const config = getConfig();
  const model = config.OPENAI_EXTRACTION_MODEL;
  const prompt = loadMetricExtractionPrompt();
  const contextPack = await buildMetricExtractionContextPack(entry, input.userTimezone);
  const toonInput = jsonContextPackToToon(contextPack);
  const inputSnapshot = { contextPack, toonInput };

  try {
    const result = await deps.chat.completeStructured({
      model,
      messages: [
        { role: 'system', content: prompt.body },
        {
          role: 'user',
          content: `Extract analytics-ready metrics (number, ordinal, boolean only). Assign timeline placement using recorded_at, tense, and narrative_order. Context pack (TOON):\n\n${toonInput}`,
        },
      ],
      schema: metricExtractionAiOutputSchema,
      schemaName: 'metric_extraction',
    });

    const entryText = entryTextForProcessing(entry) ?? '';
    const postProcessed = result.data.metrics.map((rawCandidate) =>
      postProcessCandidate(rawCandidate, entryText),
    );
    const candidates = normalizeExtractionCandidates(postProcessed, entryText, {
      entryDate: entry.entryDate,
    });
    const observedAtMap = resolveObservedAtForCandidates({
      candidates,
      entryDate: entry.entryDate,
      recordedAt: recordedAtForEntryTimeline(entry),
      timeZone: input.userTimezone,
    });

    const dropped: Array<{ key: string; reason: string }> = [];
    let persistedCount = 0;

    for (const candidate of candidates) {
      const resolved = observedAtMap.get(candidate);
      if (!resolved) {
        dropped.push({ key: candidate.candidate_key, reason: 'no_observed_at' });
        continue;
      }

      const key = resolveMetricKey(candidate);
      const existing = await findMetricDefinitionByKeyAnyStatus(input.userId, key);
      if (
        !isMetricGroundedInEntryText(
          candidate,
          entryText,
          existing?.title,
          existing ? parseAliasesJson(existing.aliasesJson) : [],
        )
      ) {
        dropped.push({ key: candidate.candidate_key, reason: 'not_grounded' });
        continue;
      }

      await persistCandidate({
        userId: input.userId,
        entry,
        candidate,
        observedAt: resolved.observedAt,
        observedAtPrecision: resolved.observedAtPrecision,
      });
      persistedCount += 1;
    }

    await markEntryExtractionSuccess(entry.id);
    await logExtractionRun({
      userId: input.userId,
      entryId: entry.id,
      model: result.model,
      promptVersion: prompt.version,
      inputSnapshot,
      outputSnapshot: {
        ...result.data,
        persisted_count: persistedCount,
        dropped,
      },
      tokenUsage: result.usage,
    });

    return { metricCount: persistedCount, skipped: false };
  } catch (error) {
    const message = normalizeOpenAiErrorMessage(error);
    await markEntryExtractionFailed(entry.id, message);
    await logExtractionRun({
      userId: input.userId,
      entryId: entry.id,
      model,
      promptVersion: prompt.version,
      inputSnapshot,
      errorJson: { message },
    });
    throw error;
  }
}

export async function maybeExtractMetrics(
  entry: DiaryEntry,
  userId: string,
  userTimezone: string,
  deps?: ExtractionDeps,
): Promise<boolean> {
  if (entry.processingStatus !== 'extracting_metrics') {
    return false;
  }

  if (await hasValidMetricExtractionRun(entry.id)) {
    return false;
  }

  try {
    const result = await extractMetricsForEntry(
      { entryId: entry.id, userId, userTimezone },
      deps,
    );
    return !result.skipped;
  } catch {
    return false;
  }
}
