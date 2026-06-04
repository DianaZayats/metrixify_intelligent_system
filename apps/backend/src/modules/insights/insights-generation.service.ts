import { randomUUID } from 'node:crypto';
import { getConfig } from '@metrixify/config';
import { jsonContextPackToToon } from '@metrixify/llm-payload-codec';
import type { AppLocale, InsightItem } from '@metrixify/shared-types';
import { loadInsightsGenerationPrompt } from '../../ai/prompt-loader.js';
import { prisma } from '../../shared/db/prisma.js';
import { createOpenAiStructuredChatClient } from '../ai-gateway/openai-chat.client.js';
import type { StructuredChatClient } from '../ai-gateway/openai-chat.client.js';
import { buildInsightsGenerationContextPack } from './insights-context.js';
import type {
  InsightsGenerationAiOutput,
  InsightsGenerationContextPack,
} from './insights.schemas.js';
import { insightsGenerationAiOutputSchema } from './insights.schemas.js';
import { createInsightReport } from './insights.repository.js';
import { toInsightReportDetail } from './insights.mapper.js';

export type GenerateInsightsInput = {
  userId: string;
  locale: AppLocale;
  timezone: string;
};

export type InsightsGenerationDeps = {
  chat: StructuredChatClient;
};

export function createDefaultInsightsGenerationDeps(): InsightsGenerationDeps {
  return {
    chat: createOpenAiStructuredChatClient(),
  };
}

function resolveCorrelationIds(
  refIndices: number[],
  context: InsightsGenerationContextPack,
): string[] {
  const ids = new Set<string>();
  for (const refIndex of refIndices) {
    const row = context.correlations[refIndex];
    if (row) {
      ids.add(row.correlation_id);
    }
  }
  return [...ids];
}

export function mapInsightsGenerationOutput(params: {
  output: InsightsGenerationAiOutput;
  context: InsightsGenerationContextPack;
}): {
  insights: Array<{
    id: string;
    titleI18n: { en: string; uk: string };
    bodyI18n: { en: string; uk: string };
    confidence: InsightItem['confidence'];
    correlationIds: string[];
  }>;
  recommendations: Array<{
    id: string;
    titleI18n: { en: string; uk: string };
    bodyI18n: { en: string; uk: string };
    relatedInsightIds: string[];
  }>;
  disclaimerI18n: { en: string; uk: string };
} {
  const insightItems = params.output.insights.map((item) => ({
    id: randomUUID(),
    titleI18n: {
      en: item.title_i18n.en.trim(),
      uk: item.title_i18n.uk.trim(),
    },
    bodyI18n: {
      en: item.body_i18n.en.trim(),
      uk: item.body_i18n.uk.trim(),
    },
    confidence: item.confidence,
    correlationIds: resolveCorrelationIds(item.correlation_ref_indices, params.context),
  }));

  const recommendations = params.output.recommendations.map((item) => ({
    id: randomUUID(),
    titleI18n: {
      en: item.title_i18n.en.trim(),
      uk: item.title_i18n.uk.trim(),
    },
    bodyI18n: {
      en: item.body_i18n.en.trim(),
      uk: item.body_i18n.uk.trim(),
    },
    relatedInsightIds: item.related_insight_indices
      .map((index) => insightItems[index]?.id)
      .filter((id): id is string => Boolean(id)),
  }));

  return {
    insights: insightItems,
    recommendations,
    disclaimerI18n: {
      en: params.output.disclaimer_i18n.en.trim(),
      uk: params.output.disclaimer_i18n.uk.trim(),
    },
  };
}

async function logInsightsGenerationRun(params: {
  userId: string;
  model: string;
  promptVersion: string;
  inputSnapshot: Record<string, unknown>;
  outputSnapshot?: Record<string, unknown>;
  errorJson?: Record<string, unknown>;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
}): Promise<string> {
  const run = await prisma.aiRun.create({
    data: {
      userId: params.userId,
      runType: 'insights_generation',
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
  return run.id;
}

export async function generateInsightsForUser(
  input: GenerateInsightsInput,
  deps: InsightsGenerationDeps = createDefaultInsightsGenerationDeps(),
) {
  const { context, correlationCalculatedAt } = await buildInsightsGenerationContextPack(input);
  const prompt = loadInsightsGenerationPrompt();
  const model = getConfig().OPENAI_INSIGHTS_MODEL;
  const toonInput = jsonContextPackToToon(context);

  let aiRunId: string | undefined;
  try {
    const completion = await deps.chat.completeStructured({
      model,
      messages: [
        { role: 'system', content: prompt.body },
        {
          role: 'user',
          content: `Generate bilingual insights and recommendations (English + Ukrainian) from this context pack:\n\n${toonInput}`,
        },
      ],
      schema: insightsGenerationAiOutputSchema,
      schemaName: 'insights_generation',
    });

    aiRunId = await logInsightsGenerationRun({
      userId: input.userId,
      model,
      promptVersion: prompt.version,
      inputSnapshot: context as unknown as Record<string, unknown>,
      outputSnapshot: completion.data as unknown as Record<string, unknown>,
      tokenUsage: completion.usage,
    });

    const mapped = mapInsightsGenerationOutput({
      output: completion.data,
      context,
    });

    const report = await createInsightReport({
      userId: input.userId,
      locale: input.locale,
      insightsJson: mapped.insights,
      recommendationsJson: mapped.recommendations,
      disclaimer: JSON.stringify(mapped.disclaimerI18n),
      inputSummaryJson: {
        profileFactCount: context.profile_facts.length,
        correlationCount: context.correlations.length,
      },
      correlationCalculatedAt,
      model,
      promptVersion: prompt.version,
      aiRunId,
    });

    return toInsightReportDetail(report, input.locale);
  } catch (error) {
    await logInsightsGenerationRun({
      userId: input.userId,
      model,
      promptVersion: prompt.version,
      inputSnapshot: context as unknown as Record<string, unknown>,
      errorJson: {
        message: error instanceof Error ? error.message : 'Unknown insights generation error',
      },
    });
    throw error;
  }
}
