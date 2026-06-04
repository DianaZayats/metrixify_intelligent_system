import { createReadStream } from 'node:fs';
import OpenAI from 'openai';
import { getConfig, getOpenAiApiKey } from '@metrixify/config';
import type { TranscriptionClient, TranscriptionResult } from './ai-gateway.types.js';

let cachedClient: OpenAI | null = null;

function getOpenAiClient(): OpenAI {
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: getOpenAiApiKey() });
  }
  return cachedClient;
}

export function resetOpenAiClientCache(): void {
  cachedClient = null;
}

export function createOpenAiTranscriptionClient(): TranscriptionClient {
  return {
    async transcribeFile(filePath: string, model: string): Promise<TranscriptionResult> {
      const config = getConfig();
      const resolvedModel = model || config.OPENAI_TRANSCRIPTION_MODEL;
      const client = getOpenAiClient();

      const startedAt = Date.now();
      const response = await client.audio.transcriptions.create({
        file: createReadStream(filePath),
        model: resolvedModel,
      });

      const text = response.text.trim();
      if (!text) {
        throw new Error('Transcription returned empty text');
      }

      return {
        text,
        model: resolvedModel,
        durationSeconds: Math.round((Date.now() - startedAt) / 1000),
      };
    },
  };
}
