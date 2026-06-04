import { dateAtLocalTime } from '../../shared/lib/zoned-datetime.js';
import type { MetricCandidate } from './metric-extraction.schemas.js';
import { OBSERVED_AT_PRECISIONS } from './metric-extraction.schemas.js';

export { OBSERVED_AT_PRECISIONS };
export type ObservedAtPrecision = (typeof OBSERVED_AT_PRECISIONS)[number];

export type ResolvedObservedAt = {
  observedAt: Date;
  observedAtPrecision: ObservedAtPrecision;
};

const DAY_START_HOUR = 7;
const DAY_START_MINUTE = 0;

function entryDateYmd(entryDate: Date): string {
  return entryDate.toISOString().slice(0, 10);
}

export function recordedAtForEntryTimeline(entry: {
  entryDate: Date;
  createdAt: Date;
}): Date {
  const entryDay = entryDateYmd(entry.entryDate);
  const createdDay = entryDateYmd(entry.createdAt);
  if (entryDay === createdDay) {
    return entry.createdAt;
  }
  return new Date(`${entryDay}T20:00:00.000Z`);
}

function parseObservedAt(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateOnlyFallback(entryDate: Date): ResolvedObservedAt {
  return {
    observedAt: new Date(`${entryDateYmd(entryDate)}T12:00:00.000Z`),
    observedAtPrecision: 'date_only',
  };
}

export function buildNarrativeOrderTimeline(params: {
  maxNarrativeOrder: number;
  entryDate: Date;
  recordedAt: Date;
  timeZone: string;
}): Map<number, Date> {
  const timeline = new Map<number, Date>();
  const { maxNarrativeOrder, entryDate, recordedAt, timeZone } = params;

  if (maxNarrativeOrder <= 0) {
    return timeline;
  }

  const dayStart = dateAtLocalTime(
    entryDateYmd(entryDate),
    DAY_START_HOUR,
    DAY_START_MINUTE,
    timeZone,
  );
  const endMs = Math.max(recordedAt.getTime(), dayStart.getTime());

  if (maxNarrativeOrder === 1) {
    timeline.set(1, new Date(endMs));
    return timeline;
  }

  const spanMs = endMs - dayStart.getTime();
  for (let order = 1; order <= maxNarrativeOrder; order++) {
    const ratio = (order - 1) / (maxNarrativeOrder - 1);
    timeline.set(order, new Date(dayStart.getTime() + ratio * spanMs));
  }

  return timeline;
}

export function resolveObservedAtForCandidates(params: {
  candidates: MetricCandidate[];
  entryDate: Date;
  recordedAt: Date;
  timeZone: string;
}): Map<MetricCandidate, ResolvedObservedAt> {
  const { candidates, entryDate, recordedAt, timeZone } = params;
  const resolved = new Map<MetricCandidate, ResolvedObservedAt>();

  const narrativeOrders = candidates
    .map((candidate) => candidate.narrative_order)
    .filter((order): order is number => typeof order === 'number' && order > 0);
  const maxNarrativeOrder = narrativeOrders.length > 0 ? Math.max(...narrativeOrders) : 0;
  const narrativeTimeline =
    maxNarrativeOrder > 0
      ? buildNarrativeOrderTimeline({
          maxNarrativeOrder,
          entryDate,
          recordedAt,
          timeZone,
        })
      : new Map<number, Date>();

  for (const candidate of candidates) {
    const explicitAt = parseObservedAt(candidate.observed_at);
    if (explicitAt && candidate.observed_at_precision === 'exact') {
      resolved.set(candidate, {
        observedAt: explicitAt,
        observedAtPrecision: 'exact',
      });
      continue;
    }

    if (candidate.observed_date) {
      resolved.set(candidate, {
        observedAt: new Date(`${candidate.observed_date}T12:00:00.000Z`),
        observedAtPrecision: 'date_only',
      });
      continue;
    }

    if (candidate.narrative_order && narrativeTimeline.has(candidate.narrative_order)) {
      resolved.set(candidate, {
        observedAt: narrativeTimeline.get(candidate.narrative_order)!,
        observedAtPrecision: candidate.observed_at_precision ?? 'inferred',
      });
      continue;
    }

    resolved.set(candidate, dateOnlyFallback(entryDate));
  }

  return resolved;
}
