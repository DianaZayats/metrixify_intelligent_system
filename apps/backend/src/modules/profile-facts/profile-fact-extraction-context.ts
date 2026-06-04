import type { DiaryEntry } from '@prisma/client';
import { entryTextForProcessing } from '../summary/summary-context.js';
import type { ProfileFactExtractionContextPack } from './profile-fact.schemas.js';
import { listActiveProfileFactsForUser } from './profile-fact.repository.js';
import { parseValueJsonText } from './profile-fact-deduplication.js';

export async function buildProfileFactExtractionContextPack(
  entry: DiaryEntry,
  userTimezone: string,
): Promise<ProfileFactExtractionContextPack> {
  const text = entryTextForProcessing(entry);
  if (!text) {
    throw new Error('Entry has no text for profile fact extraction');
  }

  const existingFacts = await listActiveProfileFactsForUser(entry.userId, 30);

  return {
    schema_version: '1',
    entry: {
      id: entry.id,
      entry_date: entry.entryDate.toISOString().slice(0, 10),
      recorded_at: entry.createdAt.toISOString(),
      source_type: entry.sourceType,
      text,
      summary: entry.summaryText,
    },
    user: {
      timezone: userTimezone,
    },
    existing_profile_facts: existingFacts.map((fact) => ({
      key: fact.key,
      value_text: parseValueJsonText(fact.valueJson),
      fact_type: fact.factType,
      stability: fact.stability === 'temporary' ? 'evolving' : fact.stability,
    })),
  };
}
