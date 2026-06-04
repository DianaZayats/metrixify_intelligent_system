import type { DiaryEntry } from '@prisma/client';
import { prisma } from '../../shared/db/prisma.js';
import { findUserById } from '../users/user.repository.js';
import { listActiveProfileFactsForUser } from '../profile-facts/profile-fact.repository.js';
import { parseValueJsonText } from '../profile-facts/profile-fact-deduplication.js';
import type { EntrySummaryContextPack } from './summary.schemas.js';

export function entryTextForProcessing(entry: DiaryEntry): string | null {
  const text = entry.rawText ?? entry.transcriptText;
  return text?.trim() ? text.trim() : null;
}

export async function buildEntrySummaryContextPack(
  entry: DiaryEntry,
  userTimezone: string,
): Promise<EntrySummaryContextPack> {
  const text = entryTextForProcessing(entry);
  if (!text) {
    throw new Error('Entry has no text to summarize');
  }

  const recent = await prisma.diaryEntry.findMany({
    where: {
      userId: entry.userId,
      id: { not: entry.id },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      entryDate: true,
      summaryText: true,
    },
  });

  const existingFacts = await listActiveProfileFactsForUser(entry.userId, 20);
  const userRecord = await findUserById(entry.userId);

  return {
    schema_version: '1',
    entry: {
      id: entry.id,
      entry_date: entry.entryDate.toISOString().slice(0, 10),
      source_type: entry.sourceType,
      text,
    },
    user: {
      timezone: userTimezone,
      preferred_locale: userRecord?.locale === 'uk' ? 'uk' : 'en',
    },
    recent_entries: recent.map((item) => ({
      entry_date: item.entryDate.toISOString().slice(0, 10),
      summary: item.summaryText,
    })),
    existing_profile_facts: existingFacts.map((fact) => ({
      key: fact.key,
      value_text: parseValueJsonText(fact.valueJson),
    })),
  };
}
