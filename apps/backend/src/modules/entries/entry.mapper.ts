import type { DiaryEntry } from '@prisma/client';
import type { AppLocale, DiaryEntryDetail, DiaryEntryListItem } from '@metrixify/shared-types';
import { listObservationsByEntry } from '../metrics/metric.repository.js';
import { toObservationItem } from '../metrics/metric.mapper.js';

export function entryPreviewText(entry: DiaryEntry): string | null {
  if (entry.summaryText) {
    return entry.summaryText;
  }
  if (entry.rawText) {
    return entry.rawText;
  }
  if (entry.transcriptText) {
    return entry.transcriptText;
  }
  if (entry.sourceType === 'voice' && entry.processingStatus === 'transcribing') {
    return null;
  }
  return null;
}

export function toListItem(entry: DiaryEntry): DiaryEntryListItem {
  return {
    id: entry.id,
    userId: entry.userId,
    sourceType: entry.sourceType,
    rawText: entry.rawText,
    summaryText: entry.summaryText,
    entryDate: entry.entryDate.toISOString().slice(0, 10),
    processingStatus: entry.processingStatus,
    createdAt: entry.createdAt.toISOString(),
  };
}

export function toDetail(entry: DiaryEntry): DiaryEntryDetail {
  return {
    ...toListItem(entry),
    transcriptText: entry.transcriptText,
    processingError: entry.processingError,
    updatedAt: entry.updatedAt.toISOString(),
    observations: [],
  };
}

export async function toDetailWithObservations(
  entry: DiaryEntry,
  userId: string,
  locale: AppLocale = 'en',
): Promise<DiaryEntryDetail> {
  const observations = await listObservationsByEntry(entry.id, userId);
  return {
    ...toDetail(entry),
    observations: observations.map((observation) => toObservationItem(observation, locale)),
  };
}
