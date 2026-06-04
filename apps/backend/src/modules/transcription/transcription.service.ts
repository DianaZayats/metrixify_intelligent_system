import { getConfig } from '@metrixify/config';
import { prisma } from '../../shared/db/prisma.js';
import { createOpenAiTranscriptionClient } from '../ai-gateway/openai-transcription.client.js';
import type { TranscriptionClient } from '../ai-gateway/ai-gateway.types.js';
import {
  downloadTelegramVoiceFile,
  removeTempAudioFile,
} from './telegram-audio.download.js';
import {
  markEntryTranscriptionFailed,
  markEntryTranscriptionSuccess,
} from '../entries/entry.repository.js';

export type VoiceTranscriptionInput = {
  entryId: string;
  userId: string;
  fileId: string;
  durationSeconds: number;
};

export type TranscriptionDeps = {
  downloadVoice: (fileId: string) => Promise<string>;
  removeVoice: (filePath: string) => Promise<void>;
  transcribe: TranscriptionClient;
};

export function createDefaultTranscriptionDeps(): TranscriptionDeps {
  return {
    downloadVoice: downloadTelegramVoiceFile,
    removeVoice: removeTempAudioFile,
    transcribe: createOpenAiTranscriptionClient(),
  };
}

async function logTranscriptionRun(params: {
  userId: string;
  entryId: string;
  model: string;
  inputSnapshot: Record<string, unknown>;
  outputSnapshot?: Record<string, unknown>;
  errorJson?: Record<string, unknown>;
}): Promise<void> {
  await prisma.aiRun.create({
    data: {
      userId: params.userId,
      entryId: params.entryId,
      runType: 'transcription',
      model: params.model,
      inputFormat: 'json',
      inputSnapshot: params.inputSnapshot,
      outputSnapshot: params.outputSnapshot,
      validationStatus: params.errorJson ? 'invalid' : 'valid',
      errorJson: params.errorJson,
      tokenUsageJson: params.outputSnapshot?.durationSeconds
        ? { durationSeconds: params.outputSnapshot.durationSeconds }
        : undefined,
    },
  });
}

export async function transcribeVoiceEntry(
  input: VoiceTranscriptionInput,
  deps: TranscriptionDeps = createDefaultTranscriptionDeps(),
): Promise<{ transcript: string }> {
  const config = getConfig();
  const model = config.OPENAI_TRANSCRIPTION_MODEL;
  let tempPath: string | null = null;

  const inputSnapshot = {
    telegramFileId: input.fileId,
    durationSeconds: input.durationSeconds,
  };

  try {
    tempPath = await deps.downloadVoice(input.fileId);
    const result = await deps.transcribe.transcribeFile(tempPath, model);

    await markEntryTranscriptionSuccess(input.entryId, result.text);
    await logTranscriptionRun({
      userId: input.userId,
      entryId: input.entryId,
      model: result.model,
      inputSnapshot,
      outputSnapshot: {
        text: result.text,
        textLength: result.text.length,
        durationSeconds: result.durationSeconds,
      },
    });

    return { transcript: result.text };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transcription failed';
    await markEntryTranscriptionFailed(input.entryId, message);
    await logTranscriptionRun({
      userId: input.userId,
      entryId: input.entryId,
      model,
      inputSnapshot,
      errorJson: { message },
    });
    throw error;
  } finally {
    if (tempPath) {
      await deps.removeVoice(tempPath).catch(() => undefined);
    }
  }
}
