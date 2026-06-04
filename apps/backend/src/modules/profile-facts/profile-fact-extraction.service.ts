import { getConfig } from '@metrixify/config';
import { jsonContextPackToToon } from '@metrixify/llm-payload-codec';
import type { DiaryEntry } from '@prisma/client';
import { loadProfileFactExtractionPrompt } from '../../ai/prompt-loader.js';
import { prisma } from '../../shared/db/prisma.js';
import { createOpenAiStructuredChatClient } from '../ai-gateway/openai-chat.client.js';
import type { StructuredChatClient } from '../ai-gateway/openai-chat.client.js';
import {
  findDiaryEntryById,
  markEntryFactExtractFailed,
  markEntryFactExtractSuccess,
} from '../entries/entry.repository.js';
import { entryTextForProcessing } from '../summary/summary-context.js';
import { buildProfileFactExtractionContextPack } from './profile-fact-extraction-context.js';
import type { ProfileFactCandidate } from './profile-fact.schemas.js';
import { profileFactExtractionAiOutputSchema } from './profile-fact.schemas.js';
import {
  filterProfileFactCandidate,
  resolveProfileFactOperation,
} from './profile-fact-deduplication.js';
import {
  appendProfileFactEvidence,
  createProfileFact,
  findProfileFactByKey,
  hasValidFactExtractionRun,
  updateProfileFactFromExtraction,
} from './profile-fact.repository.js';
import { ensureFactCandidateI18n } from './profile-fact-i18n.js';

const POST_FACT_EXTRACTION_STATUSES: DiaryEntry['processingStatus'][] = [
  'saving_results',
  'completed',
];

export type ExtractProfileFactsInput = {
  entryId: string;
  userId: string;
  userTimezone: string;
};

export type FactExtractionDeps = {
  chat: StructuredChatClient;
};

export function createDefaultFactExtractionDeps(): FactExtractionDeps {
  return {
    chat: createOpenAiStructuredChatClient(),
  };
}

async function applyCandidate(params: {
  userId: string;
  entry: DiaryEntry;
  candidate: ProfileFactCandidate;
  normalizedKey: string;
}): Promise<'created' | 'updated' | 'evidence' | 'skipped'> {
  const { userId, entry, candidate, normalizedKey } = params;
  if (!normalizedKey) {
    return 'skipped';
  }

  const enriched = ensureFactCandidateI18n(candidate);
  const existing = await findProfileFactByKey(userId, normalizedKey);
  const resolved = resolveProfileFactOperation(enriched, normalizedKey, existing);
  if (!resolved) {
    return 'skipped';
  }

  if (resolved.action === 'create') {
    const fact = await createProfileFact({
      userId,
      key: normalizedKey,
      valueText: enriched.value_text,
      valueI18n: enriched.value_i18n,
      factType: enriched.fact_type,
      stability: enriched.stability === 'temporary' ? 'evolving' : enriched.stability,
      confidence: enriched.confidence,
      entryId: entry.id,
    });
    await appendProfileFactEvidence({
      profileFactId: fact.id,
      entryId: entry.id,
      evidenceText: candidate.evidence_text,
    });
    return 'created';
  }

  if (resolved.action === 'update') {
    await updateProfileFactFromExtraction({
      factId: resolved.existingFact.id,
      valueText: enriched.value_text,
      valueI18n: enriched.value_i18n,
      factType: enriched.fact_type,
      stability: enriched.stability === 'temporary' ? 'evolving' : enriched.stability,
      confidence: enriched.confidence,
      entryId: entry.id,
    });
    await appendProfileFactEvidence({
      profileFactId: resolved.existingFact.id,
      entryId: entry.id,
      evidenceText: candidate.evidence_text,
    });
    return 'updated';
  }

  await appendProfileFactEvidence({
    profileFactId: resolved.existingFact.id,
    entryId: entry.id,
    evidenceText: candidate.evidence_text,
  });
  return 'evidence';
}

async function logFactExtractionRun(params: {
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
      runType: 'fact_extraction',
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

export async function extractProfileFactsForEntry(
  input: ExtractProfileFactsInput,
  deps?: FactExtractionDeps,
): Promise<{ factCount: number; skipped: boolean }> {
  const resolvedDeps = deps ?? createDefaultFactExtractionDeps();
  const entry = await findDiaryEntryById(input.entryId, input.userId);
  if (!entry) {
    throw new Error('Entry not found');
  }

  if (POST_FACT_EXTRACTION_STATUSES.includes(entry.processingStatus)) {
    return { factCount: 0, skipped: true };
  }

  if (await hasValidFactExtractionRun(entry.id)) {
    return { factCount: 0, skipped: true };
  }

  if (entry.processingStatus !== 'extracting_facts') {
    return { factCount: 0, skipped: true };
  }

  const config = getConfig();
  const model = config.OPENAI_FACT_EXTRACTION_MODEL;
  const prompt = loadProfileFactExtractionPrompt();
  const contextPack = await buildProfileFactExtractionContextPack(entry, input.userTimezone);
  const toonInput = jsonContextPackToToon(contextPack);
  const inputSnapshot = { contextPack, toonInput };
  const entryText = entryTextForProcessing(entry) ?? '';

  try {
    const result = await resolvedDeps.chat.completeStructured({
      model,
      messages: [
        { role: 'system', content: prompt.body },
        {
          role: 'user',
          content: `Extract stable personal profile facts from the diary entry. Context pack (TOON):\n\n${toonInput}`,
        },
      ],
      schema: profileFactExtractionAiOutputSchema,
      schemaName: 'profile_fact_extraction',
    });

    let appliedCount = 0;
    for (const rawCandidate of result.data.facts) {
      const filtered = filterProfileFactCandidate(rawCandidate, entryText);
      if (filtered.rejected) {
        continue;
      }

      const outcome = await applyCandidate({
        userId: input.userId,
        entry,
        candidate: filtered.candidate,
        normalizedKey: filtered.normalizedKey,
      });
      if (outcome !== 'skipped') {
        appliedCount += 1;
      }
    }

    await markEntryFactExtractSuccess(entry.id);
    await logFactExtractionRun({
      userId: input.userId,
      entryId: entry.id,
      model: result.model,
      promptVersion: prompt.version,
      inputSnapshot,
      outputSnapshot: result.data,
      tokenUsage: result.usage,
    });

    return { factCount: appliedCount, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Profile fact extraction failed';
    await markEntryFactExtractFailed(entry.id, message);
    await logFactExtractionRun({
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

export async function maybeExtractProfileFacts(
  entry: DiaryEntry,
  userId: string,
  userTimezone: string,
  deps?: FactExtractionDeps,
): Promise<boolean> {
  if (entry.processingStatus !== 'extracting_facts') {
    return false;
  }

  if (await hasValidFactExtractionRun(entry.id)) {
    return false;
  }

  try {
    const result = await extractProfileFactsForEntry(
      { entryId: entry.id, userId, userTimezone },
      deps,
    );
    return !result.skipped;
  } catch {
    return false;
  }
}
