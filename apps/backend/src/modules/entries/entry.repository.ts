import type { DiaryEntry, Prisma } from '@prisma/client';
import { prisma } from '../../shared/db/prisma.js';

export type CreateTextEntryInput = {
  userId: string;
  rawText: string;
  entryDate: Date;
  idempotencyKey: string;
  telegramMessageId?: bigint;
  telegramUpdateId?: bigint;
};

export async function createDiaryEntry(data: Prisma.DiaryEntryCreateInput): Promise<DiaryEntry> {
  return prisma.diaryEntry.create({ data });
}

export async function findDiaryEntryById(
  id: string,
  userId?: string,
): Promise<DiaryEntry | null> {
  return prisma.diaryEntry.findFirst({
    where: userId ? { id, userId } : { id },
  });
}

export async function findEntryByIdempotencyKey(idempotencyKey: string): Promise<DiaryEntry | null> {
  const source = await prisma.entrySource.findUnique({
    where: { idempotencyKey },
    include: { entry: true },
  });
  return source?.entry ?? null;
}

export async function createTextEntryFromTelegram(
  input: CreateTextEntryInput,
): Promise<{ entry: DiaryEntry; created: boolean }> {
  const existing = await findEntryByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    return { entry: existing, created: false };
  }

  try {
    const entry = await prisma.diaryEntry.create({
      data: {
        userId: input.userId,
        sourceType: 'text',
        rawText: input.rawText,
        entryDate: input.entryDate,
        processingStatus: 'received',
        entrySources: {
          create: {
            userId: input.userId,
            sourceType: 'text',
            idempotencyKey: input.idempotencyKey,
            telegramMessageId: input.telegramMessageId,
            telegramUpdateId: input.telegramUpdateId,
          },
        },
      },
    });
    return { entry, created: true };
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      const raced = await findEntryByIdempotencyKey(input.idempotencyKey);
      if (raced) {
        return { entry: raced, created: false };
      }
    }
    throw error;
  }
}

export type CreatePersonaTextEntryInput = {
  userId: string;
  rawText: string;
  entryDate: Date;
  idempotencyKey: string;
};

export async function createPersonaTextEntry(
  input: CreatePersonaTextEntryInput,
): Promise<{ entry: DiaryEntry; created: boolean }> {
  const existing = await findEntryByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    return { entry: existing, created: false };
  }

  try {
    const entry = await prisma.diaryEntry.create({
      data: {
        userId: input.userId,
        sourceType: 'manual',
        rawText: input.rawText,
        entryDate: input.entryDate,
        processingStatus: 'received',
        entrySources: {
          create: {
            userId: input.userId,
            sourceType: 'manual',
            idempotencyKey: input.idempotencyKey,
          },
        },
      },
    });
    return { entry, created: true };
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      const raced = await findEntryByIdempotencyKey(input.idempotencyKey);
      if (raced) {
        return { entry: raced, created: false };
      }
    }
    throw error;
  }
}

export type CreateVoiceEntryInput = {
  userId: string;
  entryDate: Date;
  idempotencyKey: string;
  telegramMessageId?: bigint;
  telegramUpdateId?: bigint;
  telegramFileId: string;
  durationSeconds: number;
};

export async function createVoiceEntryFromTelegram(
  input: CreateVoiceEntryInput,
): Promise<{ entry: DiaryEntry; created: boolean }> {
  const existing = await findEntryByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    return { entry: existing, created: false };
  }

  try {
    const entry = await prisma.diaryEntry.create({
      data: {
        userId: input.userId,
        sourceType: 'voice',
        entryDate: input.entryDate,
        processingStatus: 'transcribing',
        entrySources: {
          create: {
            userId: input.userId,
            sourceType: 'voice',
            idempotencyKey: input.idempotencyKey,
            telegramMessageId: input.telegramMessageId,
            telegramUpdateId: input.telegramUpdateId,
            metadataJson: {
              telegramFileId: input.telegramFileId,
              durationSeconds: input.durationSeconds,
            },
          },
        },
      },
    });
    return { entry, created: true };
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      const raced = await findEntryByIdempotencyKey(input.idempotencyKey);
      if (raced) {
        return { entry: raced, created: false };
      }
    }
    throw error;
  }
}

export async function markEntryTranscriptionSuccess(
  entryId: string,
  transcript: string,
): Promise<DiaryEntry> {
  return prisma.diaryEntry.update({
    where: { id: entryId },
    data: {
      rawText: transcript,
      transcriptText: transcript,
      processingStatus: 'transcribed',
      processingError: null,
    },
  });
}

export async function markEntryTranscriptionFailed(
  entryId: string,
  errorMessage: string,
): Promise<DiaryEntry> {
  return prisma.diaryEntry.update({
    where: { id: entryId },
    data: {
      processingStatus: 'failed',
      processingError: errorMessage,
    },
  });
}

export async function markEntrySummarizing(entryId: string): Promise<void> {
  await prisma.diaryEntry.update({
    where: { id: entryId },
    data: {
      processingStatus: 'summarizing',
      processingError: null,
    },
  });
}

export async function markEntrySummarySuccess(
  entryId: string,
  summary: string,
): Promise<DiaryEntry> {
  return prisma.diaryEntry.update({
    where: { id: entryId },
    data: {
      summaryText: summary,
      processingStatus: 'extracting_metrics',
      processingError: null,
    },
  });
}

export async function markEntrySummaryFailed(
  entryId: string,
  errorMessage: string,
  revertStatus: DiaryEntry['processingStatus'],
): Promise<DiaryEntry> {
  return prisma.diaryEntry.update({
    where: { id: entryId },
    data: {
      processingStatus: revertStatus,
      processingError: errorMessage,
    },
  });
}

export async function markEntryExtractionSuccess(entryId: string): Promise<DiaryEntry> {
  return prisma.diaryEntry.update({
    where: { id: entryId },
    data: {
      processingStatus: 'resolving_schema',
      processingError: null,
    },
  });
}

export async function markEntryExtractionFailed(
  entryId: string,
  errorMessage: string,
): Promise<DiaryEntry> {
  return prisma.diaryEntry.update({
    where: { id: entryId },
    data: {
      processingStatus: 'extracting_metrics',
      processingError: errorMessage,
    },
  });
}

export async function markEntrySchemaResolveSuccess(entryId: string): Promise<DiaryEntry> {
  return prisma.diaryEntry.update({
    where: { id: entryId },
    data: {
      processingStatus: 'extracting_facts',
      processingError: null,
    },
  });
}

export async function markEntryFactExtractSuccess(entryId: string): Promise<DiaryEntry> {
  return prisma.diaryEntry.update({
    where: { id: entryId },
    data: {
      processingStatus: 'completed',
      processingError: null,
    },
  });
}

export async function markEntryCompletedAfterSchema(entryId: string): Promise<DiaryEntry> {
  return prisma.diaryEntry.update({
    where: { id: entryId },
    data: {
      processingStatus: 'completed',
      processingError: null,
    },
  });
}

export async function markEntryForMetricsReprocess(entryId: string): Promise<DiaryEntry> {
  return prisma.diaryEntry.update({
    where: { id: entryId },
    data: {
      processingStatus: 'extracting_metrics',
      processingError: null,
    },
  });
}

export async function clearEntryMetricsPipelineData(
  entryId: string,
  userId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.metricObservation.deleteMany({ where: { entryId, userId } });
    await tx.aiRun.deleteMany({
      where: {
        entryId,
        userId,
        runType: { in: ['metric_extraction', 'schema_resolver'] },
      },
    });
  });
}

export async function markEntryFactExtractFailed(
  entryId: string,
  errorMessage: string,
): Promise<DiaryEntry> {
  return prisma.diaryEntry.update({
    where: { id: entryId },
    data: {
      processingStatus: 'extracting_facts',
      processingError: errorMessage,
    },
  });
}

export async function markEntrySchemaResolveFailed(
  entryId: string,
  errorMessage: string,
): Promise<DiaryEntry> {
  return prisma.diaryEntry.update({
    where: { id: entryId },
    data: {
      processingStatus: 'resolving_schema',
      processingError: errorMessage,
    },
  });
}

export async function updateEntryProcessingStatus(
  entryId: string,
  processingStatus: DiaryEntry['processingStatus'],
): Promise<void> {
  await prisma.diaryEntry.update({
    where: { id: entryId },
    data: { processingStatus },
  });
}

export async function listDiaryEntriesByUser(
  userId: string,
  options: { take?: number; skip?: number },
): Promise<{ items: DiaryEntry[]; total: number }> {
  const where = { userId };
  const [items, total] = await Promise.all([
    prisma.diaryEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.take ?? 50,
      skip: options.skip ?? 0,
    }),
    prisma.diaryEntry.count({ where }),
  ]);
  return { items, total };
}

export async function listRecentEntriesByUser(
  userId: string,
  take = 5,
): Promise<DiaryEntry[]> {
  return prisma.diaryEntry.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

export async function findDiaryEntryByTelegramSummaryMessageId(
  userId: string,
  summaryMessageId: bigint,
): Promise<DiaryEntry | null> {
  return prisma.diaryEntry.findFirst({
    where: {
      userId,
      metadataJson: {
        path: ['telegram', 'summaryMessageId'],
        equals: String(summaryMessageId),
      },
    },
  });
}

export async function findDiaryEntryByTelegramInboundMessageId(
  userId: string,
  inboundMessageId: bigint,
): Promise<DiaryEntry | null> {
  const source = await prisma.entrySource.findFirst({
    where: {
      userId,
      telegramMessageId: inboundMessageId,
    },
    include: { entry: true },
  });
  return source?.entry ?? null;
}

export type EntryTelegramContext = {
  chatId: string;
  inboundMessageId: string;
  summaryMessageId: string;
};

function parseEntryMetadata(metadataJson: unknown): Record<string, unknown> {
  if (!metadataJson || typeof metadataJson !== 'object' || Array.isArray(metadataJson)) {
    return {};
  }
  return { ...(metadataJson as Record<string, unknown>) };
}

export async function updateEntryTelegramContext(
  entryId: string,
  userId: string,
  context: EntryTelegramContext,
): Promise<void> {
  const entry = await findDiaryEntryById(entryId, userId);
  if (!entry) {
    return;
  }

  const metadata = parseEntryMetadata(entry.metadataJson);
  await prisma.diaryEntry.update({
    where: { id: entryId },
    data: {
      metadataJson: {
        ...metadata,
        telegram: context,
      },
    },
  });
}

export async function updateEntryDate(entryId: string, entryDate: Date): Promise<DiaryEntry> {
  return prisma.diaryEntry.update({
    where: { id: entryId },
    data: { entryDate },
  });
}

export async function realignObservationsToEntryDate(
  entryId: string,
  entryDate: Date,
): Promise<number> {
  const observedAt = new Date(`${entryDate.toISOString().slice(0, 10)}T12:00:00.000Z`);
  const result = await prisma.metricObservation.updateMany({
    where: { entryId },
    data: { observedAt },
  });
  return result.count;
}
