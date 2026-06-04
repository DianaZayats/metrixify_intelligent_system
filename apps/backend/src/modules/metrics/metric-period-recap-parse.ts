import type { MetricCandidate } from './metric-extraction.schemas.js';

const PERIOD_RECAP_MARKER = /підсумок(?:\s+(?:періоду|тижня))?|period recap|weekly recap/i;
const YESTERDAY_LINE = /^(?:вчора|yesterday)(?:\s*\([^)]+\))?\s*[—–-]\s*(.+)/i;

/** Monday = 0 … Sunday = 6 (ISO-style week anchored on Monday). */
const UK_WEEKDAY_INDEX: Record<string, number> = {
  понеділок: 0,
  monday: 0,
  вівторок: 1,
  tuesday: 1,
  середу: 2,
  sereda: 2,
  wednesday: 2,
  четвер: 3,
  thursday: 3,
  "п'ятницю": 4,
  пятницю: 4,
  friday: 4,
  суботу: 5,
  saturday: 5,
  неділю: 6,
  sunday: 6,
};

const UK_WEEKDAY_PATTERN = Object.keys(UK_WEEKDAY_INDEX).join('|');

const UK_MONTH_GENITIVE: Record<string, number> = {
  січня: 1,
  лютого: 2,
  березня: 3,
  квітня: 4,
  травня: 5,
  червня: 6,
  липня: 7,
  серпня: 8,
  вересня: 9,
  жовтня: 10,
  листопада: 11,
  грудня: 12,
};

const UK_MONTH_PATTERN = Object.keys(UK_MONTH_GENITIVE).join('|');
const WEEKDAY_LINE = new RegExp(
  `^(?:у\\s+)?(${UK_WEEKDAY_PATTERN})\\s*(?:\\((\\d{1,2})\\s+(${UK_MONTH_PATTERN})\\))?\\s*[—–-]\\s*(.+)`,
  'i',
);
const EXPLICIT_UK_DATE_LINE = new RegExp(
  `(\\d{1,2})\\s+(${UK_MONTH_PATTERN})\\s*[—–-]\\s*(.+)`,
  'i',
);
const PAREN_UK_DATE = new RegExp(`\\((\\d{1,2})\\s+(${UK_MONTH_PATTERN})\\)`, 'i');

export function isPeriodRecapEntry(entryText: string): boolean {
  return PERIOD_RECAP_MARKER.test(entryText);
}

function dayBeforeIso(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function startOfWeekMondayIso(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  const day = date.getUTCDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  return date.toISOString().slice(0, 10);
}

function weekdayInEntryWeek(isoEntryDate: string, weekdayIndex: number): string {
  const monday = startOfWeekMondayIso(isoEntryDate);
  const date = new Date(`${monday}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + weekdayIndex);
  return date.toISOString().slice(0, 10);
}

function resolveUkWeekday(weekdayToken: string): number | null {
  const normalized = weekdayToken.toLowerCase().replace(/[''’]/g, "'");
  return UK_WEEKDAY_INDEX[normalized] ?? UK_WEEKDAY_INDEX[normalized.replace(/'/g, '')] ?? null;
}

function entryDateIso(entryDate: Date): string {
  return entryDate.toISOString().slice(0, 10);
}

function toObservedDate(day: number, monthGenitive: string, year: number): string | null {
  const month = UK_MONTH_GENITIVE[monthGenitive.toLowerCase()];
  if (!month) {
    return null;
  }
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseNutsFromClause(clause: string): boolean | null {
  const text = clause.toLowerCase();
  if (/перекусив горіхами|горіхов|арахіс|had nuts|ate nuts|nuts,| nuts\b/.test(text)) {
    return true;
  }
  if (/без горіхів|no nuts/.test(text)) {
    return false;
  }
  return null;
}

export function parseRashFromClause(clause: string): boolean | null {
  const text = clause.toLowerCase();
  if (/без висипу|no rash/.test(text)) {
    return false;
  }
  if (/висип|сверб|плям|itch|rash/.test(text)) {
    return true;
  }
  return null;
}

type ParsedRecapLine = {
  observedDate: string;
  clause: string;
  lineText: string;
};

export function parsePeriodRecapLines(entryText: string, entryDate: Date): ParsedRecapLine[] {
  const year = Number(entryDateIso(entryDate).slice(0, 4));
  const lines: ParsedRecapLine[] = [];

  for (const segment of entryText.split(/(?<=[.!?])\s+/)) {
    const trimmed = segment.trim();
    if (!trimmed) {
      continue;
    }

    let day: number | null = null;
    let month: string | null = null;
    let clause = trimmed;
    let observedDate: string | null = null;

    const yesterday = trimmed.match(YESTERDAY_LINE);
    if (yesterday) {
      observedDate = dayBeforeIso(entryDateIso(entryDate));
      clause = yesterday[1]!.trim().replace(/[.!?]+$/, '');
    }

    const explicit = trimmed.match(EXPLICIT_UK_DATE_LINE);
    if (explicit) {
      day = Number(explicit[1]);
      month = explicit[2]!.toLowerCase();
      clause = explicit[3]!.trim();
    } else if (!observedDate) {
      const weekday = trimmed.match(WEEKDAY_LINE);
      if (weekday) {
        clause = weekday[4]!.trim().replace(/[.!?]+$/, '');
        if (weekday[2] && weekday[3]) {
          day = Number(weekday[2]);
          month = weekday[3]!.toLowerCase();
        } else {
          const weekdayIndex = resolveUkWeekday(weekday[1]!);
          if (weekdayIndex == null) {
            continue;
          }
          observedDate = weekdayInEntryWeek(entryDateIso(entryDate), weekdayIndex);
        }
      } else {
        const paren = trimmed.match(PAREN_UK_DATE);
        if (paren) {
          day = Number(paren[1]);
          month = paren[2]!.toLowerCase();
          const dash = trimmed.match(/[—–-]\s*(.+)$/);
          clause = dash?.[1]?.trim() ?? trimmed;
        }
      }
    }

    if (!observedDate) {
      if (day == null || !month) {
        continue;
      }

      observedDate = toObservedDate(day, month, year);
      if (!observedDate) {
        continue;
      }
    }

    lines.push({
      observedDate,
      clause,
      lineText: trimmed,
    });
  }

  return lines;
}

function booleanCandidate(params: {
  key: string;
  title: string;
  value: boolean;
  observedDate: string;
  evidenceText: string;
  tags: string[];
}): MetricCandidate {
  return {
    candidate_key: params.key,
    title: params.title,
    value_type: 'boolean',
    value_number: null,
    value_text: null,
    value_boolean: params.value,
    unit: null,
    scale_min: null,
    scale_max: null,
    evidence_text: params.evidenceText.slice(0, 500),
    confidence: 0.92,
    reasoning: 'Parsed from weekly period recap line',
    observed_date: params.observedDate,
    observed_at: null,
    observed_at_precision: 'date_only',
    narrative_order: null,
    tags: params.tags,
  };
}

const DEFAULT_BOOLEAN_KEYS = {
  nuts: 'nuts_consumed',
  rash: 'skin_rash_occurred',
} as const;

export function extractPeriodRecapBooleanCandidates(
  entryText: string,
  entryDate: Date,
  metricKeys: { nuts?: string; rash?: string } = {},
): MetricCandidate[] {
  if (!isPeriodRecapEntry(entryText)) {
    return [];
  }

  const nutsKey = metricKeys.nuts ?? DEFAULT_BOOLEAN_KEYS.nuts;
  const rashKey = metricKeys.rash ?? DEFAULT_BOOLEAN_KEYS.rash;
  const result: MetricCandidate[] = [];

  for (const line of parsePeriodRecapLines(entryText, entryDate)) {
    const nuts = parseNutsFromClause(line.clause);
    const rash = parseRashFromClause(line.clause);

    if (nuts !== null) {
      result.push(
        booleanCandidate({
          key: nutsKey,
          title: 'Nuts consumed',
          value: nuts,
          observedDate: line.observedDate,
          evidenceText: line.lineText,
          tags: ['nutrition', 'habits'],
        }),
      );
    }

    if (rash !== null) {
      result.push(
        booleanCandidate({
          key: rashKey,
          title: 'Skin rash occurred',
          value: rash,
          observedDate: line.observedDate,
          evidenceText: line.lineText,
          tags: ['health'],
        }),
      );
    }
  }

  return result;
}

function periodRecapBooleanSlotKey(candidate: MetricCandidate): string | null {
  if (candidate.value_type !== 'boolean' || !candidate.observed_date) {
    return null;
  }
  return `${candidate.candidate_key.toLowerCase()}|${candidate.observed_date}`;
}

export function reconcilePeriodRecapCandidates(
  candidates: MetricCandidate[],
  entryText: string,
  entryDate: Date,
): MetricCandidate[] {
  const deterministic = extractPeriodRecapBooleanCandidates(entryText, entryDate);
  if (deterministic.length === 0) {
    return candidates.filter(
      (candidate) =>
        !(
          candidate.value_type === 'boolean' &&
          candidate.value_boolean === false &&
          !candidate.observed_date
        ),
    );
  }

  const replacedSlots = new Set(
    deterministic
      .map((candidate) => periodRecapBooleanSlotKey(candidate))
      .filter((slot): slot is string => slot != null),
  );
  const reconciledKeys = new Set(
    deterministic.map((candidate) => candidate.candidate_key.toLowerCase()),
  );

  const kept = candidates.filter((candidate) => {
    const key = candidate.candidate_key.toLowerCase();
    if (!reconciledKeys.has(key)) {
      return true;
    }
    if (candidate.value_type !== 'boolean') {
      return true;
    }

    const slot = periodRecapBooleanSlotKey(candidate);
    if (slot && replacedSlots.has(slot)) {
      return false;
    }

    // Drop clause-bleed booleans without a calendar day; keep dated LLM rows deterministic did not parse.
    return Boolean(candidate.observed_date);
  });

  return [...kept, ...deterministic];
}
