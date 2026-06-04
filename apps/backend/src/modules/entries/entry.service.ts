import type { DiaryEntry } from '@prisma/client';
import { entryDateForTimezone, parseEntryDateFromText } from '../../shared/lib/entry-date.js';
import { parsedEntryDateFromEntryText } from '../../shared/lib/entry-date-sync.js';
import { ApiError } from '../../shared/errors/api-error.js';
import { upsertUserFromTelegram } from '../users/user.repository.js';
import {
  createPersonaTextEntry,
  createTextEntryFromTelegram,
  createVoiceEntryFromTelegram,
  findDiaryEntryById,
  listDiaryEntriesByUser,
  listRecentEntriesByUser,
  markEntryCompletedAfterSchema,
  clearEntryMetricsPipelineData,
  markEntryForMetricsReprocess,
  realignObservationsToEntryDate,
  updateEntryDate,
  updateEntryTelegramContext,
} from './entry.repository.js';
import type { z } from 'zod';
import {
  isAppLocale,
  type AppLocale,
  type TelegramMessageIngestResponse,
  type TelegramVoiceIngestResponse,
} from '@metrixify/shared-types';
import type { telegramMessageIngestSchema, telegramVoiceIngestSchema } from './entries.schemas.js';
import { transcribeVoiceEntry } from '../transcription/transcription.service.js';
import { maybeSummarizeEntry } from '../summary/summary.service.js';
import { maybeExtractMetrics } from '../metrics/metric-extraction.service.js';
import { maybeResolveSchema } from '../metrics/metric-schema-resolver.service.js';
import { maybeExtractProfileFacts } from '../profile-facts/profile-fact-extraction.service.js';
import { toDetailWithObservations } from './entry.mapper.js';

async function runEntryAiPipeline(
  entry: DiaryEntry,
  userId: string,
  userTimezone: string,
  options?: { skipProfileFacts?: boolean },
): Promise<void> {
  await maybeSummarizeEntry(entry, userId, userTimezone);
  const afterSummary = await findDiaryEntryById(entry.id, userId);
  if (afterSummary) {
    await maybeExtractMetrics(afterSummary, userId, userTimezone);
    const afterExtraction = await findDiaryEntryById(entry.id, userId);
    if (afterExtraction) {
      await maybeResolveSchema(afterExtraction, userId);
      if (options?.skipProfileFacts) {
        const afterSchema = await findDiaryEntryById(entry.id, userId);
        if (afterSchema?.processingStatus === 'extracting_facts') {
          await markEntryCompletedAfterSchema(entry.id);
        }
      } else {
        const afterSchema = await findDiaryEntryById(entry.id, userId);
        if (afterSchema) {
          await maybeExtractProfileFacts(afterSchema, userId, userTimezone);
        }
      }
    }
  }
}

export type TelegramIngestInput = z.infer<typeof telegramMessageIngestSchema>;
export type TelegramVoiceIngestInput = z.infer<typeof telegramVoiceIngestSchema>;

export function buildTelegramIdempotencyKey(updateId: number): string {
  return `telegram:${updateId}`;
}

async function buildTelegramIngestResult(
  entryId: string,
  userId: string,
  locale: string,
  created: boolean,
): Promise<TelegramMessageIngestResponse> {
  const entry = await findDiaryEntryById(entryId, userId);
  if (!entry) {
    throw new ApiError(404, 'NOT_FOUND', 'Entry not found');
  }

  const appLocale: AppLocale = isAppLocale(locale) ? locale : 'en';
  const detail = await toDetailWithObservations(entry, userId, appLocale);
  return {
    entryId,
    created,
    processingStatus: detail.processingStatus,
    processingError: detail.processingError,
    observations: detail.observations,
  };
}

export async function saveTelegramEntrySummaryMessage(input: {
  entryId: string;
  telegramUserId: number;
  chatId: number;
  inboundMessageId: number;
  summaryMessageId: number;
}): Promise<void> {
  const user = await upsertUserFromTelegram({
    telegramUserId: BigInt(input.telegramUserId),
  });

  await updateEntryTelegramContext(input.entryId, user.id, {
    chatId: String(input.chatId),
    inboundMessageId: String(input.inboundMessageId),
    summaryMessageId: String(input.summaryMessageId),
  });
}

export async function ingestTelegramTextMessage(
  input: TelegramIngestInput,
): Promise<TelegramMessageIngestResponse> {
  if (input.chatType !== 'private') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Only private chats are supported');
  }

  const user = await upsertUserFromTelegram({
    telegramUserId: BigInt(input.telegramUserId),
    username: input.username,
    firstName: input.firstName,
    lastName: input.lastName,
    languageCode: input.languageCode,
  });

  const parsedDate = parseEntryDateFromText(input.text);
  const entryDate = parsedDate ?? entryDateForTimezone(user.timezone);
  const idempotencyKey = buildTelegramIdempotencyKey(input.updateId);

  const { entry, created } = await createTextEntryFromTelegram({
    userId: user.id,
    rawText: input.text.trim(),
    entryDate,
    idempotencyKey,
    telegramMessageId: BigInt(input.messageId),
    telegramUpdateId: BigInt(input.updateId),
  });

  await runEntryAiPipeline(entry, user.id, user.timezone);

  return buildTelegramIngestResult(entry.id, user.id, user.locale, created);
}

export async function ingestPersonaTextEntry(params: {
  userId: string;
  userTimezone: string;
  entryDate: Date;
  rawText: string;
  idempotencyKey: string;
  skipProfileFacts?: boolean;
}): Promise<{ entryId: string; created: boolean; processingStatus: DiaryEntry['processingStatus'] }> {
  const { entry, created } = await createPersonaTextEntry({
    userId: params.userId,
    rawText: params.rawText.trim(),
    entryDate: params.entryDate,
    idempotencyKey: params.idempotencyKey,
  });

  await runEntryAiPipeline(entry, params.userId, params.userTimezone, {
    skipProfileFacts: params.skipProfileFacts,
  });
  const refreshed = await findDiaryEntryById(entry.id, params.userId);

  return {
    entryId: entry.id,
    created,
    processingStatus: refreshed?.processingStatus ?? entry.processingStatus,
  };
}

export async function ingestTelegramVoiceMessage(
  input: TelegramVoiceIngestInput,
): Promise<TelegramVoiceIngestResponse> {
  if (input.chatType !== 'private') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Only private chats are supported');
  }

  const user = await upsertUserFromTelegram({
    telegramUserId: BigInt(input.telegramUserId),
    username: input.username,
    firstName: input.firstName,
    lastName: input.lastName,
    languageCode: input.languageCode,
  });

  const entryDate = entryDateForTimezone(user.timezone);
  const idempotencyKey = buildTelegramIdempotencyKey(input.updateId);

  const { entry, created } = await createVoiceEntryFromTelegram({
    userId: user.id,
    entryDate,
    idempotencyKey,
    telegramMessageId: BigInt(input.messageId),
    telegramUpdateId: BigInt(input.updateId),
    telegramFileId: input.fileId,
    durationSeconds: input.duration,
  });

  if (entry.processingStatus === 'transcribed' && entry.transcriptText) {
    await runEntryAiPipeline(entry, user.id, user.timezone);
    return {
      ...(await buildTelegramIngestResult(entry.id, user.id, user.locale, created)),
      transcribed: true,
    };
  }

  if (entry.processingStatus === 'failed') {
    return {
      ...(await buildTelegramIngestResult(entry.id, user.id, user.locale, created)),
      transcribed: false,
    };
  }

  try {
    await transcribeVoiceEntry({
      entryId: entry.id,
      userId: user.id,
      fileId: input.fileId,
      durationSeconds: input.duration,
    });
    const refreshed = await findDiaryEntryById(entry.id, user.id);
    if (refreshed) {
      await applyParsedEntryDateFromText(refreshed.id, user.id);
      const afterDate = (await findDiaryEntryById(entry.id, user.id)) ?? refreshed;
      await runEntryAiPipeline(afterDate, user.id, user.timezone);
    }
    return {
      ...(await buildTelegramIngestResult(entry.id, user.id, user.locale, created)),
      transcribed: true,
    };
  } catch {
    return {
      ...(await buildTelegramIngestResult(entry.id, user.id, user.locale, created)),
      transcribed: false,
    };
  }
}

export async function getEntriesForUser(userId: string, limit: number, offset: number) {
  return listDiaryEntriesByUser(userId, { take: limit, skip: offset });
}

export async function getEntryByIdForUser(id: string, userId: string): Promise<DiaryEntry> {
  const entry = await findDiaryEntryById(id, userId);
  if (!entry) {
    throw new ApiError(404, 'NOT_FOUND', 'Entry not found');
  }
  return entry;
}

export async function getRecentEntriesForTelegramUser(
  telegramUserId: number,
  take = 5,
): Promise<DiaryEntry[]> {
  const user = await upsertUserFromTelegram({
    telegramUserId: BigInt(telegramUserId),
  });
  return listRecentEntriesByUser(user.id, take);
}

export async function reprocessEntryMetricsForUser(
  entryId: string,
  userId: string,
  userTimezone: string,
): Promise<DiaryEntry> {
  const entry = await getEntryByIdForUser(entryId, userId);
  if (!entry.rawText?.trim() && !entry.transcriptText?.trim()) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Entry has no text to extract metrics from');
  }

  await clearEntryMetricsPipelineData(entryId, userId);

  let current = await findDiaryEntryById(entryId, userId);
  if (!current) {
    throw new ApiError(404, 'NOT_FOUND', 'Entry not found');
  }

  if (!current.summaryText?.trim()) {
    await maybeSummarizeEntry(current, userId, userTimezone);
    current = (await findDiaryEntryById(entryId, userId)) ?? current;
  }

  await markEntryForMetricsReprocess(entryId);

  current = (await findDiaryEntryById(entryId, userId)) ?? current;

  await maybeExtractMetrics(current, userId, userTimezone);
  current = (await findDiaryEntryById(entryId, userId)) ?? current;
  assertMetricsReprocessHealthy(current);

  await maybeResolveSchema(current, userId);
  current = (await findDiaryEntryById(entryId, userId)) ?? current;
  assertMetricsReprocessHealthy(current);

  if (current.processingStatus === 'extracting_facts') {
    await markEntryCompletedAfterSchema(entryId);
    current = (await findDiaryEntryById(entryId, userId)) ?? current;
  }

  return current;
}

export type ApplyParsedEntryDateResult = {
  updated: boolean;
  entryDate: string | null;
  observationsRealigned: number;
};

/** Set entryDate from inline YYYY-MM-DD in raw/transcript text; realign observation dates. */
export async function applyParsedEntryDateFromText(
  entryId: string,
  userId: string,
): Promise<ApplyParsedEntryDateResult> {
  const entry = await findDiaryEntryById(entryId, userId);
  if (!entry) {
    return { updated: false, entryDate: null, observationsRealigned: 0 };
  }

  const parsed = parsedEntryDateFromEntryText(entry.rawText, entry.transcriptText);
  if (!parsed) {
    return { updated: false, entryDate: null, observationsRealigned: 0 };
  }

  const target = parsed.toISOString().slice(0, 10);
  const current = entry.entryDate.toISOString().slice(0, 10);
  if (current === target) {
    return { updated: false, entryDate: target, observationsRealigned: 0 };
  }

  await updateEntryDate(entryId, parsed);
  const observationsRealigned = await realignObservationsToEntryDate(entryId, parsed);
  return { updated: true, entryDate: target, observationsRealigned };
}

export async function backfillEntryDatesForUser(userId: string): Promise<{
  updated: number;
  skipped: number;
  observationsRealigned: number;
}> {
  const { items: entries } = await listDiaryEntriesByUser(userId, { take: 500, skip: 0 });
  let updated = 0;
  let skipped = 0;
  let observationsRealigned = 0;

  for (const entry of entries) {
    const result = await applyParsedEntryDateFromText(entry.id, userId);
    if (result.updated) {
      updated += 1;
      observationsRealigned += result.observationsRealigned;
    } else {
      skipped += 1;
    }
  }

  return { updated, skipped, observationsRealigned };
}

function assertMetricsReprocessHealthy(entry: DiaryEntry): void {
  if (entry.processingError) {
    throw new ApiError(502, 'AI_PIPELINE_FAILED', entry.processingError, {
      processingStatus: entry.processingStatus,
    });
  }
  if (entry.processingStatus === 'extracting_metrics') {
    throw new ApiError(502, 'AI_PIPELINE_FAILED', 'Metric extraction did not complete', {
      processingStatus: entry.processingStatus,
    });
  }
}
