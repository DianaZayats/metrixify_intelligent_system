/**
 * Detect duration mentions in Russian/English diary text (minutes focus for MVP).
 */
export type ExplicitDuration = {
  value: number;
  unit: 'min';
  match: string;
};

const RU_NUMBER_WORDS: Record<string, number> = {
  один: 1,
  одна: 1,
  одну: 1,
  два: 2,
  две: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
  одиннадцать: 11,
  двенадцать: 12,
  пятнадцать: 15,
  двадцать: 20,
  тридцать: 30,
  сорок: 40,
  пятьдесят: 50,
  шестьдесят: 60,
};

const WORD_END = '(?=\\s|$|[.,!?;:])';

const DURATION_PATTERNS: RegExp[] = [
  new RegExp(
    `(\\d+(?:[.,]\\d+)?)\\s*(?:мин(?:ут(?:ы)?)?|minutes?|min)${WORD_END}`,
    'gi',
  ),
  new RegExp(
    `(?:мин(?:ут(?:ы)?)?|minutes?)\\s*(?:на\\s+)?(\\d+|[a-zа-яё]+)${WORD_END}`,
    'gi',
  ),
  new RegExp(
    `(?:проб(?:е)?жал|бегал|run(?:ning)?|ran)\\s*(?:где-то\\s*)?(?:мин(?:ут(?:ы)?)?|minutes?)\\s*(?:на\\s+)?(\\d+|[a-zа-яё]+)${WORD_END}`,
    'gi',
  ),
  new RegExp(
    `(?:поспал|sleep(?:ing)?|лёг|лег)\\s*(?:поспать\\s*)?(?:мин(?:ут(?:ы)?)?|minutes?)\\s*(?:на\\s+)?(\\d+|[a-zа-яё]+)${WORD_END}`,
    'gi',
  ),
];

const HOUR_DURATION_PATTERNS: RegExp[] = [
  /(?:проб(?:е)?жал|бегал|run(?:ning)?|ran|был)\s+(?:где-то\s+)?(?:час|один\s+час|an?\s+hour)/i,
  /(?:^|\s)(?:час|один\s+час|an?\s+hour)(?:\s|$|[.,!?;:])/i,
];

const REPEATED_SESSION_PATTERN =
  /(?:^|\s)(два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|\d+)\s+раз(?:а)?(?=\s|[,.!?;:]|$)/i;

function parseDurationToken(raw: string): number | null {
  const normalized = raw.trim().toLowerCase().replace(',', '.');
  if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }
  return RU_NUMBER_WORDS[normalized] ?? null;
}

function dedupeNestedDurations(items: ExplicitDuration[]): ExplicitDuration[] {
  return items.filter(
    (item) =>
      !items.some(
        (other) =>
          other !== item &&
          item.match.length > other.match.length &&
          item.match.includes(other.match),
      ),
  );
}

export function findExplicitDurations(text: string): ExplicitDuration[] {
  const durations: ExplicitDuration[] = [];
  const seenMatches = new Set<string>();

  for (const pattern of DURATION_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const token = match[1];
      if (!token) {
        continue;
      }
      const value = parseDurationToken(token);
      if (value === null || value <= 0) {
        continue;
      }
      const normalizedMatch = match[0].trim().toLowerCase();
      if (seenMatches.has(normalizedMatch)) {
        continue;
      }
      seenMatches.add(normalizedMatch);
      durations.push({
        value,
        unit: 'min',
        match: match[0].trim(),
      });
    }
  }

  return dedupeNestedDurations(durations);
}

export function findHourDurationInEvidence(evidenceText: string): ExplicitDuration | null {
  for (const pattern of HOUR_DURATION_PATTERNS) {
    if (pattern.test(evidenceText)) {
      const match = evidenceText.match(pattern)?.[0]?.trim();
      if (match) {
        return { value: 60, unit: 'min', match };
      }
    }
  }
  return null;
}

function isMinuteDurationCandidate(candidate: {
  value_type: string;
  unit: string | null;
  candidate_key?: string;
}): boolean {
  if (candidate.value_type !== 'number') {
    return false;
  }
  const unit = candidate.unit?.toLowerCase() ?? '';
  if (unit === 'min' || unit === 'mins' || unit === 'minute' || unit === 'minutes') {
    return true;
  }
  const key = candidate.candidate_key?.toLowerCase() ?? '';
  return key.includes('duration') || key.includes('_min') || key.includes('minutes');
}

function bestDurationForEvidence(
  durations: ExplicitDuration[],
  evidenceText: string,
): ExplicitDuration | null {
  if (durations.length === 0) {
    return null;
  }

  const evidenceLower = evidenceText.toLowerCase();
  return durations.find((item) => evidenceLower.includes(item.match.toLowerCase())) ?? null;
}

export function findRepeatedSessionMultiplier(text: string): number {
  const match = text.match(REPEATED_SESSION_PATTERN);
  if (!match?.[1]) {
    return 1;
  }
  const parsed = parseDurationToken(match[1]);
  return parsed !== null && parsed > 1 ? parsed : 1;
}

export function resolveExplicitDurationMinutes(
  evidenceText: string,
  options?: { existingValue?: number | null },
): number | null {
  const minuteDuration = bestDurationForEvidence(
    findExplicitDurations(evidenceText),
    evidenceText,
  );
  const hourDuration = findHourDurationInEvidence(evidenceText);
  const base = minuteDuration ?? hourDuration;
  if (!base) {
    return options?.existingValue ?? null;
  }

  const multiplier = findRepeatedSessionMultiplier(evidenceText);
  const computed = base.value * multiplier;
  const existing = options?.existingValue;

  if (existing != null && multiplier > 1 && existing >= computed) {
    return existing;
  }

  return computed;
}

export function applyExplicitDurationFromEntryText<
  T extends {
    candidate_key?: string;
    value_type: string;
    value_number: number | null;
    unit: string | null;
    evidence_text: string;
    confidence: number;
  },
>(candidate: T, _entryText: string): T {
  if (!isMinuteDurationCandidate(candidate)) {
    return candidate;
  }

  const resolvedMinutes = resolveExplicitDurationMinutes(candidate.evidence_text, {
    existingValue: candidate.value_number,
  });

  if (resolvedMinutes === null) {
    return candidate;
  }

  return {
    ...candidate,
    value_number: resolvedMinutes,
    unit: 'min',
    confidence: Math.max(candidate.confidence, 0.88),
  };
}
