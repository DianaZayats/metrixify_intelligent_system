import type { MetricCandidate } from './metric-extraction.schemas.js';
import { findExplicitRatings } from './metric-rating-parse.js';
import { resolveExplicitDurationMinutes } from './metric-duration-parse.js';
import { reconcilePeriodRecapCandidates } from './metric-period-recap-parse.js';

const DAYTIME_NAP_EVIDENCE =
  /(?:лёг|лег)\s+поспать|дневн(?:ой|ого|ым)\s+сон|поспал\s+(?:минут|днём)|daytime\s+nap/i;
const NIGHT_SLEEP_EVIDENCE = /(?:ночью|ночной\s+сон|проснулся\s+ночью|night\s+sleep)/i;
const PET_PROJECT_EVIDENCE = /pet[-\s]?проект|pet\s+project|личн(?:ый|ого)\s+проект/i;
const MAIN_JOB_EVIDENCE =
  /основн(?:ой|ая|ую|ой)\s+работ|на\s+работ[еу]|main\s+job|employer/i;
const RECAP_MARKERS =
  /итог\s+дня|(?:утром|потом|после\s+этого|затем|вечером|днём).{10,}(?:утром|потом|после|затем|вечером)/is;
const CROSS_DAY_WORDS = ['позавчера', 'вчера', 'сегодня', 'yesterday', 'today'] as const;
const CROSS_DAY_BEFORE_BOUNDARY = /[\s,.!?;:(«"'"\[]/;
const CROSS_DAY_AFTER_BOUNDARY = /[\s,.!?;:)"»"'"\]]/;

function hasCrossDayWord(text: string, word: string): boolean {
  let fromIndex = 0;
  while (fromIndex < text.length) {
    const index = text.indexOf(word, fromIndex);
    if (index === -1) {
      return false;
    }

    const beforeOk = index === 0 || CROSS_DAY_BEFORE_BOUNDARY.test(text[index - 1]!);
    const afterIndex = index + word.length;
    const afterOk =
      afterIndex >= text.length || CROSS_DAY_AFTER_BOUNDARY.test(text[afterIndex]!);

    if (beforeOk && afterOk) {
      return true;
    }

    fromIndex = index + 1;
  }

  return false;
}

function extractCrossDayMarkers(entryText: string): Set<string> {
  const text = entryText.toLowerCase();
  const found = new Set<string>();
  for (const word of CROSS_DAY_WORDS) {
    if (hasCrossDayWord(text, word)) {
      found.add(word);
    }
  }
  return found;
}
const MISCLASSIFIED_FITNESS_DURATION_KEY =
  /^(?:gym_session_duration|run_duration|workout_duration)(?:_|$)/;
const DAYTIME_NAP_PHRASE =
  /(?:(?:два|две|три|четыре|пять|\d+)\s+раз(?:а)?\s+)?(?:лёг|лег)\s+поспать[^.!?]{0,80}/i;
const EXPLICIT_COUNT_PATTERN =
  /\d+|(?:один|одна|две|два|три|четыре|пять|шесть|семь|восемь|девять|десять)\s+(?:раз|штук|задач|тикет|item)/i;
const JUNK_NUMBER_WITHOUT_COUNT_KEYS = new Set([
  'number_of_items_worked_on',
  'items_completed',
  'tasks_completed',
]);

const ENERGY_METRIC_KEY = /(?:^energy$|acute_energy|energy_level)/i;
const STRESS_METRIC_KEY = /(?:stress|anxiety|тривож|стрес)/i;
const ANXIETY_EVIDENCE = /(?:тривож|стрес|anxiety|stress|тревог)/i;
const ENERGY_EVIDENCE = /(?:енерг|energy|втом|fatigue|бодр)/i;
const ANXIETY_PHRASE =
  /(?:без\s+сильн(?:ої|ой|ого)\s+тривож(?:ності|ность|nosti)?|(?:низьк(?:ий|а)|low)\s+(?:рівень\s+)?(?:тривож|стрес|anxiety)|without\s+strong\s+anxiety)/i;

function evidenceIndex(entryText: string, evidenceText: string): number {
  const needle = evidenceText.trim().toLowerCase().slice(0, 48);
  if (!needle) {
    return Number.MAX_SAFE_INTEGER;
  }
  const idx = entryText.toLowerCase().indexOf(needle);
  return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER;
}

function cloneCandidate(candidate: MetricCandidate, patch: Partial<MetricCandidate>): MetricCandidate {
  return { ...candidate, ...patch };
}

function uniqueTags(existing: string[], defaults: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const tag of [...existing, ...defaults]) {
    const normalized = tag.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    merged.push(normalized);
  }
  return merged.slice(0, 10);
}

function isDaytimeNapEvidence(evidence: string): boolean {
  return DAYTIME_NAP_EVIDENCE.test(evidence) && !NIGHT_SLEEP_EVIDENCE.test(evidence);
}

function isMisclassifiedFitnessDurationKey(key: string): boolean {
  return MISCLASSIFIED_FITNESS_DURATION_KEY.test(key);
}

function findDaytimeNapPhrase(entryText: string): string | null {
  const match = entryText.match(DAYTIME_NAP_PHRASE);
  return match?.[0]?.trim() ?? null;
}

function filterJunkMetrics(candidates: MetricCandidate[]): MetricCandidate[] {
  return candidates.filter((candidate) => {
    const key = candidate.candidate_key.toLowerCase();
    if (!JUNK_NUMBER_WITHOUT_COUNT_KEYS.has(key)) {
      return true;
    }
    return EXPLICIT_COUNT_PATTERN.test(candidate.evidence_text);
  });
}

function ensureDaytimeNapDuration(
  candidates: MetricCandidate[],
  entryText: string,
): MetricCandidate[] {
  const napOccurred = candidates.find((candidate) => candidate.candidate_key === 'daytime_nap_occurred');
  const hasDuration = candidates.some(
    (candidate) => candidate.candidate_key === 'daytime_nap_duration_minutes',
  );
  if (!napOccurred || hasDuration) {
    return candidates;
  }

  const napPhrase =
    findDaytimeNapPhrase(entryText) ??
    (isDaytimeNapEvidence(napOccurred.evidence_text) ? napOccurred.evidence_text : null);
  if (!napPhrase) {
    return candidates;
  }

  const durationMinutes = resolveExplicitDurationMinutes(napPhrase);
  if (durationMinutes == null || durationMinutes <= 0) {
    return candidates;
  }

  return [
    ...candidates,
    cloneCandidate(napOccurred, {
      candidate_key: 'daytime_nap_duration_minutes',
      title: 'Daytime nap duration',
      value_type: 'number',
      value_number: durationMinutes,
      value_boolean: null,
      unit: 'min',
      scale_min: null,
      scale_max: null,
      evidence_text: napPhrase,
      tags: uniqueTags(napOccurred.tags, ['sleep']),
      confidence: Math.max(napOccurred.confidence, 0.8),
    }),
  ];
}

function buildDaytimeNapCandidates(candidate: MetricCandidate, entryText: string): MetricCandidate[] {
  const evidence = candidate.evidence_text;
  const napPhrase = findDaytimeNapPhrase(entryText) ?? evidence;
  const durationMinutes = resolveExplicitDurationMinutes(napPhrase, {
    existingValue: candidate.value_number,
  });

  const result: MetricCandidate[] = [
    cloneCandidate(candidate, {
      candidate_key: 'daytime_nap_occurred',
      title: 'Daytime nap',
      value_type: 'boolean',
      value_number: null,
      value_boolean: true,
      unit: null,
      scale_min: null,
      scale_max: null,
      tags: uniqueTags(candidate.tags, ['sleep', 'routine']),
      confidence: Math.max(candidate.confidence, 0.85),
    }),
  ];

  if (durationMinutes != null && durationMinutes > 0) {
    result.push(
      cloneCandidate(candidate, {
        candidate_key: 'daytime_nap_duration_minutes',
        title: 'Daytime nap duration',
        value_type: 'number',
        value_number: durationMinutes,
        value_boolean: null,
        unit: 'min',
        scale_min: null,
        scale_max: null,
        evidence_text: evidence,
        tags: uniqueTags(candidate.tags, ['sleep']),
        confidence: Math.max(candidate.confidence, 0.8),
      }),
    );
  }

  return result;
}

function remapDaytimeNapMetrics(candidates: MetricCandidate[], entryText: string): MetricCandidate[] {
  const result: MetricCandidate[] = [];

  for (const candidate of candidates) {
    const key = candidate.candidate_key.toLowerCase();

    if (
      (key === 'sleep_quality' || isMisclassifiedFitnessDurationKey(key)) &&
      isDaytimeNapEvidence(candidate.evidence_text)
    ) {
      result.push(...buildDaytimeNapCandidates(candidate, entryText));
      continue;
    }

    result.push(candidate);
  }

  return result;
}

/** LLM sometimes labels anxiety/stress clauses as energy — remap before grounding drops them. */
function remapMisclassifiedEnergyToStress(candidates: MetricCandidate[]): MetricCandidate[] {
  return candidates.map((candidate) => {
    if (!ENERGY_METRIC_KEY.test(candidate.candidate_key)) {
      return candidate;
    }

    const evidence = candidate.evidence_text;
    if (ANXIETY_EVIDENCE.test(evidence) && !ENERGY_EVIDENCE.test(evidence)) {
      return cloneCandidate(candidate, {
        candidate_key: 'stress_level',
        title: STRESS_METRIC_KEY.test(candidate.title) ? candidate.title : 'Stress level',
        tags: uniqueTags(candidate.tags, ['stress']),
      });
    }

    return candidate;
  });
}

function hasStressLikeCandidate(candidates: MetricCandidate[]): boolean {
  return candidates.some((candidate) =>
    STRESS_METRIC_KEY.test(`${candidate.candidate_key} ${candidate.title}`),
  );
}

function extractAnxietyEvidencePhrase(entryText: string): string | null {
  const match = entryText.match(ANXIETY_PHRASE);
  return match?.[0]?.trim() ?? null;
}

/** Fallback when LLM omits stress but the entry mentions low anxiety explicitly. */
function ensureStressFromAnxietyMention(
  candidates: MetricCandidate[],
  entryText: string,
): MetricCandidate[] {
  const phrase = extractAnxietyEvidencePhrase(entryText);
  if (!phrase || hasStressLikeCandidate(candidates)) {
    return candidates;
  }

  return [
    ...candidates,
    {
      candidate_key: 'stress_level',
      title: 'Stress level',
      value_type: 'ordinal',
      value_number: 2,
      value_text: null,
      value_boolean: null,
      unit: null,
      scale_min: 1,
      scale_max: 10,
      evidence_text: phrase,
      confidence: 0.88,
      reasoning: null,
      observed_date: null,
      observed_at: null,
      observed_at_precision: null,
      narrative_order: null,
      tags: ['stress'],
    },
  ];
}

function scoreDuplicateCandidate(candidate: MetricCandidate): number {
  let score = candidate.confidence * 10;
  if (findExplicitRatings(candidate.evidence_text).length > 0) {
    score += 100;
  }
  if (/\d/.test(candidate.evidence_text)) {
    score += 5;
  }
  return score;
}

/** Keep one candidate per key — prefer explicit X/Y rating in evidence, then confidence. */
export function dedupeCandidatesByKey(candidates: MetricCandidate[]): MetricCandidate[] {
  const groups = new Map<string, MetricCandidate[]>();

  for (const candidate of candidates) {
    const key = candidate.candidate_key.toLowerCase();
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }

  const result: MetricCandidate[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]!);
      continue;
    }

    const best = group.reduce((winner, current) =>
      scoreDuplicateCandidate(current) > scoreDuplicateCandidate(winner) ? current : winner,
    );
    result.push(best);
  }

  return result;
}

function remapGenericProductivity(candidates: MetricCandidate[]): MetricCandidate[] {
  return candidates.map((candidate) => {
    const key = candidate.candidate_key.toLowerCase();
    if (key !== 'productivity') {
      return candidate;
    }

    const evidence = candidate.evidence_text;
    if (PET_PROJECT_EVIDENCE.test(evidence)) {
      return cloneCandidate(candidate, {
        candidate_key: 'personal_project_productivity',
        title: 'Personal project productivity',
      });
    }
    if (MAIN_JOB_EVIDENCE.test(evidence)) {
      return cloneCandidate(candidate, {
        candidate_key: 'main_job_productivity',
        title: 'Main job productivity',
      });
    }
    return candidate;
  });
}

export function isCrossDayEntry(entryText: string, candidates: MetricCandidate[]): boolean {
  const markers = extractCrossDayMarkers(entryText);
  if (markers.has('вчера') && markers.has('сегодня')) {
    return true;
  }
  if (markers.has('позавчера') && markers.has('сегодня')) {
    return true;
  }
  if (markers.has('yesterday') && markers.has('today')) {
    return true;
  }

  const observedDates = candidates
    .map((candidate) => candidate.observed_date)
    .filter((value): value is string => Boolean(value));
  return new Set(observedDates).size > 1;
}

function clearRecapTimelineFields(candidates: MetricCandidate[]): MetricCandidate[] {
  return candidates.map((candidate) =>
    cloneCandidate(candidate, {
      narrative_order: null,
      observed_at: candidate.observed_at_precision === 'exact' ? candidate.observed_at : null,
      observed_at_precision:
        candidate.observed_at_precision === 'exact' ? candidate.observed_at_precision : null,
    }),
  );
}

export function isRecapStyleEntry(entryText: string, candidates: MetricCandidate[]): boolean {
  if (isCrossDayEntry(entryText, candidates)) {
    return false;
  }

  if (RECAP_MARKERS.test(entryText)) {
    return true;
  }

  const chronologyMarkers =
    entryText.match(/(?:^|[\s,.!?])(?:утром|потом|после|затем|вечером|днём|позже)/gi) ?? [];
  if (chronologyMarkers.length >= 2 && candidates.length >= 3) {
    return true;
  }

  const observedAtValues = candidates
    .map((candidate) => candidate.observed_at)
    .filter((value): value is string => Boolean(value));
  const uniqueObservedAt = new Set(observedAtValues);
  if (
    candidates.length >= 3 &&
    uniqueObservedAt.size === 1 &&
    candidates.every((candidate) => candidate.narrative_order === 1)
  ) {
    return true;
  }

  return false;
}

export function assignNarrativeOrdersByEvidence(
  candidates: MetricCandidate[],
  entryText: string,
): MetricCandidate[] {
  const sorted = [...candidates].sort(
    (a, b) => evidenceIndex(entryText, a.evidence_text) - evidenceIndex(entryText, b.evidence_text),
  );

  let order = 0;
  let lastIndex = Number.MIN_SAFE_INTEGER;
  const orderByCandidate = new Map<MetricCandidate, number>();

  for (const candidate of sorted) {
    const index = evidenceIndex(entryText, candidate.evidence_text);
    if (index !== lastIndex) {
      order += 1;
      lastIndex = index;
    }
    orderByCandidate.set(candidate, order);
  }

  return candidates.map((candidate) => {
    const narrativeOrder = orderByCandidate.get(candidate) ?? candidate.narrative_order ?? 1;
    return cloneCandidate(candidate, {
      observed_at: null,
      observed_at_precision: 'inferred',
      narrative_order: narrativeOrder,
    });
  });
}

export function normalizeExtractionCandidates(
  candidates: MetricCandidate[],
  entryText: string,
  options?: { entryDate?: Date },
): MetricCandidate[] {
  let normalized = remapDaytimeNapMetrics(candidates, entryText);
  normalized = remapMisclassifiedEnergyToStress(normalized);
  normalized = remapGenericProductivity(normalized);
  normalized = filterJunkMetrics(normalized);
  normalized = ensureDaytimeNapDuration(normalized, entryText);
  normalized = ensureStressFromAnxietyMention(normalized, entryText);

  if (options?.entryDate) {
    normalized = reconcilePeriodRecapCandidates(normalized, entryText, options.entryDate);
  }

  if (isCrossDayEntry(entryText, normalized)) {
    normalized = clearRecapTimelineFields(normalized);
  } else if (isRecapStyleEntry(entryText, normalized)) {
    normalized = assignNarrativeOrdersByEvidence(normalized, entryText);
  }

  normalized = dedupeCandidatesByKey(normalized);

  return normalized;
}
