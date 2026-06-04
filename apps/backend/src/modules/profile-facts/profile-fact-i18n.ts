import type { LocalizedString } from '@metrixify/shared-types';
import type { ProfileFactCandidate } from './profile-fact.schemas.js';

export function ensureFactCandidateI18n(
  candidate: ProfileFactCandidate,
): ProfileFactCandidate & { value_i18n: LocalizedString } {
  const valueI18n = candidate.value_i18n ?? { en: candidate.value_text.trim() };
  if (!valueI18n.en.trim()) {
    valueI18n.en = candidate.value_text.trim();
  }
  return {
    ...candidate,
    value_text: valueI18n.en.trim(),
    value_i18n: valueI18n,
  };
}
