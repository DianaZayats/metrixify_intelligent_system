import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { z } from 'zod';
import { getOpenAiApiKey } from '@metrixify/config';
import { isRetryableOpenAiError } from '../../shared/lib/openai-error.js';

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type StructuredChatResult<T> = {
  data: T;
  model: string;
  usage?: TokenUsage;
};

export type StructuredChatClient = {
  completeStructured<TSchema extends z.ZodTypeAny>(params: {
    model: string;
    messages: OpenAI.Chat.ChatCompletionMessageParam[];
    schema: TSchema;
    schemaName: string;
  }): Promise<StructuredChatResult<z.infer<TSchema>>>;
};

let cachedClient: OpenAI | null = null;

const OPENAI_TIMEOUT_MS = 120_000;
const OPENAI_MAX_ATTEMPTS = 3;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getOpenAiClient(): Promise<OpenAI> {
  if (!cachedClient) {
    cachedClient = new OpenAI({
      apiKey: getOpenAiApiKey(),
      timeout: OPENAI_TIMEOUT_MS,
      maxRetries: 0,
    });
  }
  return cachedClient;
}

export function resetOpenAiChatClientCache(): void {
  cachedClient = null;
}

export function createOpenAiStructuredChatClient(): StructuredChatClient {
  return {
    async completeStructured(params) {
      const client = await getOpenAiClient();
      let lastError: unknown;

      for (let attempt = 1; attempt <= OPENAI_MAX_ATTEMPTS; attempt += 1) {
        try {
          const completion = await client.beta.chat.completions.parse({
            model: params.model,
            messages: params.messages,
            response_format: zodResponseFormat(params.schema, params.schemaName),
          });

          const message = completion.choices[0]?.message;
          if (!message?.parsed) {
            const refusal = message?.refusal ?? 'Structured output parse failed';
            throw new Error(typeof refusal === 'string' ? refusal : 'Structured output parse failed');
          }

          return {
            data: message.parsed as z.infer<typeof params.schema>,
            model: completion.model,
            usage: completion.usage
              ? {
                  promptTokens: completion.usage.prompt_tokens,
                  completionTokens: completion.usage.completion_tokens,
                  totalTokens: completion.usage.total_tokens,
                }
              : undefined,
          };
        } catch (error) {
          lastError = error;
          if (!isRetryableOpenAiError(error) || attempt === OPENAI_MAX_ATTEMPTS) {
            throw error;
          }
          await sleep(1000 * attempt);
        }
      }

      throw lastError instanceof Error ? lastError : new Error('OpenAI request failed');
    },
  };
}
