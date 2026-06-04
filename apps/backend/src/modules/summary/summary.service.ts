import { getConfig } from '@metrixify/config';
import { jsonContextPackToToon } from '@metrixify/llm-payload-codec';
import type { DiaryEntry } from '@prisma/client';
import { loadEntrySummaryPrompt } from '../../ai/prompt-loader.js';
import { prisma } from '../../shared/db/prisma.js';
import { createOpenAiStructuredChatClient } from '../ai-gateway/openai-chat.client.js';
import type { StructuredChatClient } from '../ai-gateway/openai-chat.client.js';
import {
  findDiaryEntryById,
  markEntrySummarizing,
  markEntrySummaryFailed,
  markEntrySummarySuccess,
} from '../entries/entry.repository.js';
import { buildEntrySummaryContextPack, entryTextForProcessing } from './summary-context.js';
import { entrySummaryOutputSchema } from './summary.schemas.js';

export type SummarizeEntryInput = {
  entryId: string;
  userId: string;
  userTimezone: string;
};

export type SummaryDeps = {
  chat: StructuredChatClient;
};

export function createDefaultSummaryDeps(): SummaryDeps {
  return {
    chat: createOpenAiStructuredChatClient(),
  };
}

function statusBeforeSummary(entry: DiaryEntry): DiaryEntry['processingStatus'] {
  if (entry.sourceType === 'voice' || entry.processingStatus === 'transcribed') {
    return 'transcribed';
  }
  return 'received';
}

async function logSummaryRun(params: {
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
      runType: 'summary',
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

export async function summarizeEntry(
  input: SummarizeEntryInput,
  deps: SummaryDeps = createDefaultSummaryDeps(),
): Promise<{ summary: string; skipped: boolean }> {
  const entry = await findDiaryEntryById(input.entryId, input.userId);
  if (!entry) {
    throw new Error('Entry not found');
  }

  if (entry.summaryText) {
    return { summary: entry.summaryText, skipped: true };
  }

  const text = entryTextForProcessing(entry);
  if (!text) {
    throw new Error('Entry has no text to summarize');
  }

  const config = getConfig();
  const model = config.OPENAI_SUMMARY_MODEL;
  const prompt = loadEntrySummaryPrompt();
  const revertStatus = statusBeforeSummary(entry);

  const contextPack = await buildEntrySummaryContextPack(entry, input.userTimezone);
  const toonInput = jsonContextPackToToon(contextPack);
  const inputSnapshot = {
    contextPack,
    toonInput,
  };

  await markEntrySummarizing(entry.id);

  try {
    const result = await deps.chat.completeStructured({
      model,
      messages: [
        { role: 'system', content: prompt.body },
        {
          role: 'user',
          content: `Summarize this diary entry. Context pack (TOON):\n\n${toonInput}`,
        },
      ],
      schema: entrySummaryOutputSchema,
      schemaName: 'entry_summary',
    });

    const summary = result.data.summary.trim();
    await markEntrySummarySuccess(entry.id, summary);
    await logSummaryRun({
      userId: input.userId,
      entryId: entry.id,
      model: result.model,
      promptVersion: prompt.version,
      inputSnapshot,
      outputSnapshot: result.data,
      tokenUsage: result.usage,
    });

    return { summary, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Summary generation failed';
    await markEntrySummaryFailed(entry.id, message, revertStatus);
    await logSummaryRun({
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

export async function maybeSummarizeEntry(
  entry: DiaryEntry,
  userId: string,
  userTimezone: string,
  deps?: SummaryDeps,
): Promise<boolean> {
  if (entry.summaryText || !entryTextForProcessing(entry)) {
    return false;
  }

  if (entry.processingStatus === 'failed') {
    return false;
  }

  try {
    await summarizeEntry({ entryId: entry.id, userId, userTimezone }, deps);
    return true;
  } catch {
    return false;
  }
}
