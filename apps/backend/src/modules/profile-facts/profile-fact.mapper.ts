import type { ProfileFact } from '@prisma/client';
import type { AppLocale, ProfileFactListItem } from '@metrixify/shared-types';
import { classifyProfileFactReliability } from '@metrixify/shared-types';
import { parseLocalizedString, resolveLocalized } from '@metrixify/shared-types';
import { parseValueJsonText } from './profile-fact-deduplication.js';

export function resolveProfileFactValue(fact: ProfileFact, locale: AppLocale): string {
  const fallback = parseValueJsonText(fact.valueJson);
  return resolveLocalized(parseLocalizedString(fact.valueI18n), locale, fallback);
}

export function toProfileFactListItem(
  fact: ProfileFact,
  locale: AppLocale = 'en',
): ProfileFactListItem {
  return {
    id: fact.id,
    key: fact.key,
    valueText: resolveProfileFactValue(fact, locale),
    factType: fact.factType,
    stability: fact.stability,
    status: fact.status,
    confidence: fact.confidence,
    evidenceCount: fact.evidenceCount,
    reliability: classifyProfileFactReliability(fact.confidence, fact.evidenceCount),
    firstSeenEntryId: fact.firstSeenEntryId,
    lastSeenEntryId: fact.lastSeenEntryId,
    createdAt: fact.createdAt.toISOString(),
    updatedAt: fact.updatedAt.toISOString(),
  };
}
