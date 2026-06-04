import type { TelegramConversationTurn } from '@prisma/client';
import { getConfig } from '@metrixify/config';
import { jsonContextPackToToon } from '@metrixify/llm-payload-codec';
import { loadTelegramMessageRoutingPrompt } from '../../ai/prompt-loader.js';
import { createOpenAiStructuredChatClient } from '../ai-gateway/openai-chat.client.js';
import type { StructuredChatClient } from '../ai-gateway/openai-chat.client.js';
import {
  buildTelegramMessageRoutingContextPack,
  type RecentEntryRoutingContext,
} from './telegram-message-routing-context.js';
import { telegramMessageRoutingAiOutputSchema } from './telegram-message-routing.schemas.js';
import {
  findLastCorrectionEntryId,
  isDeicticCorrectionMessage,
} from './telegram-metric-correction-dialog.js';

export type ClassifyTelegramMessageResult = {
  kind: 'diary_entry' | 'correction';
  entryId: string | null;
  reasoning: string | null;
};

export type ClassifyTelegramMessageInput = {
  text: string;
  replyToMessageId?: number | null;
  replyEntryId?: string | null;
  recentTurns: TelegramConversationTurn[];
  recentEntries: RecentEntryRoutingContext[];
};

export type TelegramRoutingDeps = {
  chat: StructuredChatClient;
};

export function createDefaultTelegramRoutingDeps(): TelegramRoutingDeps {
  return {
    chat: createOpenAiStructuredChatClient(),
  };
}

const MIN_TERM_LENGTH = 4;

function significantTerms(text: string): Set<string> {
  const terms = new Set<string>();
  for (const word of text.toLowerCase().split(/[^a-z0-9а-яёіїєґ]+/i)) {
    if (word.length >= MIN_TERM_LENGTH) {
      terms.add(word);
    }
  }
  return terms;
}

function entryCorrectionOverlap(
  entry: RecentEntryRoutingContext,
  correctionText: string,
): number {
  const entryTerms = significantTerms(entry.rawTextPreview ?? '');
  const correctionTerms = significantTerms(correctionText);
  let score = 0;
  for (const term of correctionTerms) {
    if (entryTerms.has(term)) {
      score += 1;
    }
  }
  return score;
}

function findLastSummarizedEntryId(
  recentTurns: TelegramConversationTurn[],
  allowedIds: Set<string>,
): string | null {
  for (const turn of recentTurns) {
    if (turn.turnType === 'diary_summary' && turn.entryId && allowedIds.has(turn.entryId)) {
      return turn.entryId;
    }
  }
  return null;
}

export function resolveCorrectionTargetEntryId(
  correctionText: string,
  targetEntryId: string | null,
  replyEntryId: string | null | undefined,
  recentTurns: TelegramConversationTurn[],
  recentEntries: RecentEntryRoutingContext[],
): string | null {
  const allowedIds = new Set(recentEntries.map((entry) => entry.id));

  if (replyEntryId && allowedIds.has(replyEntryId)) {
    return replyEntryId;
  }

  const scored = recentEntries
    .map((entry) => ({
      id: entry.id,
      score: entryCorrectionOverlap(entry, correctionText),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  const llmTarget = targetEntryId && allowedIds.has(targetEntryId)
    ? recentEntries.find((entry) => entry.id === targetEntryId)
    : null;
  const llmScore = llmTarget ? entryCorrectionOverlap(llmTarget, correctionText) : 0;

  if (best && (best.score >= 2 || best.score > llmScore)) {
    return best.id;
  }

  if (isDeicticCorrectionMessage(correctionText)) {
    const fromCorrection = findLastCorrectionEntryId(recentTurns, allowedIds);
    if (fromCorrection) {
      return fromCorrection;
    }
  }

  const lastSummarized = findLastSummarizedEntryId(recentTurns, allowedIds);
  if (lastSummarized && (!targetEntryId || llmScore < 1)) {
    return lastSummarized;
  }

  if (targetEntryId && allowedIds.has(targetEntryId)) {
    return targetEntryId;
  }

  return lastSummarized;
}

export async function classifyTelegramMessageWithAi(
  input: ClassifyTelegramMessageInput,
  deps: TelegramRoutingDeps = createDefaultTelegramRoutingDeps(),
): Promise<ClassifyTelegramMessageResult> {
  const config = getConfig();
  const model = config.OPENAI_EXTRACTION_MODEL;
  const prompt = loadTelegramMessageRoutingPrompt();
  const contextPack = buildTelegramMessageRoutingContextPack(input);
  const toonInput = jsonContextPackToToon(contextPack);

  try {
    const result = await deps.chat.completeStructured({
      model,
      messages: [
        { role: 'system', content: prompt.body },
        {
          role: 'user',
          content: `Classify the incoming Telegram message intent. Context pack (TOON):\n\n${toonInput}`,
        },
      ],
      schema: telegramMessageRoutingAiOutputSchema,
      schemaName: 'telegram_message_routing',
    });

    if (result.data.intent === 'diary_entry') {
      return {
        kind: 'diary_entry',
        entryId: null,
        reasoning: result.data.reasoning,
      };
    }

    return {
      kind: 'correction',
      entryId: resolveCorrectionTargetEntryId(
        input.text,
        result.data.target_entry_id,
        input.replyEntryId,
        input.recentTurns,
        input.recentEntries,
      ),
      reasoning: result.data.reasoning,
    };
  } catch (error) {
    console.error('[telegram-routing] LLM classification failed, defaulting to diary_entry', error);
    return {
      kind: 'diary_entry',
      entryId: null,
      reasoning: null,
    };
  }
}
