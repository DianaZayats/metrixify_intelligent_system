export const MIN_CORRELATION_SAMPLE = 14;
export const EXPLORATORY_MIN_CORRELATION_SAMPLE = 7;

export const CORRELATION_LAG_DAYS = [-1, 0, 1] as const;
export type CorrelationLagDays = (typeof CORRELATION_LAG_DAYS)[number];

export const CORRELATION_METHODS = ['pearson', 'spearman'] as const;
export type CorrelationMethod = (typeof CORRELATION_METHODS)[number];

export const STRENGTH_LABELS = ['negligible', 'weak', 'moderate', 'strong'] as const;
export type StrengthLabel = (typeof STRENGTH_LABELS)[number];

export const SAMPLE_TIERS = ['low', 'medium', 'higher'] as const;
export type SampleTier = (typeof SAMPLE_TIERS)[number];

export type AnalyticsValueType = 'number' | 'ordinal' | 'boolean' | 'category';

export type RawObservation = {
  observedAt: Date;
  valueNumber: number | null;
  valueBoolean: boolean | null;
};

export type DailyPoint = {
  date: string;
  value: number;
};

export type MetricSeriesInput = {
  metricId: string;
  valueType: AnalyticsValueType;
  observations: RawObservation[];
};

export type ComputedCorrelation = {
  metricAId: string;
  metricBId: string;
  method: CorrelationMethod;
  lagDays: number;
  sampleSize: number;
  correlationValue: number;
  strengthLabel: StrengthLabel;
  sampleTier: SampleTier;
  exploratory: boolean;
};

/** Pearson correlation for paired numeric samples. */
export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) {
    return null;
  }

  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX * denY);
  if (den === 0) {
    return null;
  }

  return num / den;
}

function rankValues(values: number[]): number[] {
  const indexed = values.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => a.value - b.value);

  const ranks = new Array<number>(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1]!.value === indexed[i]!.value) {
      j += 1;
    }
    const avgRank = (i + j + 2) / 2;
    for (let k = i; k <= j; k += 1) {
      ranks[indexed[k]!.index] = avgRank;
    }
    i = j + 1;
  }

  return ranks;
}

/** Spearman rank correlation for paired numeric samples. */
export function spearmanCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) {
    return null;
  }
  return pearsonCorrelation(rankValues(xs), rankValues(ys));
}

export function observationToNumeric(
  observation: RawObservation,
  valueType: AnalyticsValueType,
): number | null {
  if (valueType === 'category') {
    return null;
  }
  if (valueType === 'boolean') {
    if (observation.valueBoolean === null) {
      return null;
    }
    return observation.valueBoolean ? 1 : 0;
  }
  return observation.valueNumber;
}

export function calendarDayKey(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function aggregateDailySeries(
  observations: RawObservation[],
  valueType: AnalyticsValueType,
  timezone: string,
): DailyPoint[] {
  const buckets = new Map<string, number[]>();

  for (const observation of observations) {
    const numeric = observationToNumeric(observation, valueType);
    if (numeric === null) {
      continue;
    }
    const day = calendarDayKey(observation.observedAt, timezone);
    const list = buckets.get(day) ?? [];
    list.push(numeric);
    buckets.set(day, list);
  }

  const points: DailyPoint[] = [];
  for (const [date, values] of buckets.entries()) {
    if (values.length === 0) {
      continue;
    }
    let value: number;
    if (valueType === 'boolean') {
      value = values.some((v) => v >= 0.5) ? 1 : 0;
    } else if (valueType === 'number') {
      value = values.reduce((a, b) => a + b, 0);
    } else {
      value = values.reduce((a, b) => a + b, 0) / values.length;
    }
    points.push({ date, value });
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

export function seriesToMap(series: DailyPoint[]): Map<string, number> {
  return new Map(series.map((point) => [point.date, point.value]));
}

/** Align two daily series for correlation; lagDays shifts series B relative to A. */
export function alignPairedSeries(
  seriesA: DailyPoint[],
  seriesB: DailyPoint[],
  lagDays: number,
): { xs: number[]; ys: number[]; dates: string[] } {
  const mapA = seriesToMap(seriesA);
  const mapB = seriesToMap(seriesB);
  const dates = new Set<string>([...mapA.keys(), ...mapB.keys()]);
  const sortedDates = [...dates].sort();

  const xs: number[] = [];
  const ys: number[] = [];
  const pairedDates: string[] = [];

  for (const date of sortedDates) {
    const valueA = mapA.get(date);
    if (valueA === undefined) {
      continue;
    }

    const targetDate = shiftDateKey(date, lagDays);
    const valueB = mapB.get(targetDate);
    if (valueB === undefined) {
      continue;
    }

    xs.push(valueA);
    ys.push(valueB);
    pairedDates.push(date);
  }

  return { xs, ys, dates: pairedDates };
}

function shiftDateKey(dateKey: string, lagDays: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + lagDays);
  return date.toISOString().slice(0, 10);
}

export function strengthLabelFromR(r: number): StrengthLabel {
  const abs = Math.abs(r);
  if (abs >= 0.7) {
    return 'strong';
  }
  if (abs >= 0.4) {
    return 'moderate';
  }
  if (abs >= 0.2) {
    return 'weak';
  }
  return 'negligible';
}

export function sampleTier(sampleSize: number): SampleTier {
  if (sampleSize >= 40) {
    return 'higher';
  }
  if (sampleSize >= 20) {
    return 'medium';
  }
  return 'low';
}

export function correlatePair(params: {
  seriesA: DailyPoint[];
  seriesB: DailyPoint[];
  lagDays: number;
  method: CorrelationMethod;
  minSample?: number;
}): { correlationValue: number; sampleSize: number } | null {
  const minSample = params.minSample ?? MIN_CORRELATION_SAMPLE;
  const { xs, ys } = alignPairedSeries(params.seriesA, params.seriesB, params.lagDays);
  if (xs.length < minSample) {
    return null;
  }

  const r =
    params.method === 'spearman'
      ? spearmanCorrelation(xs, ys)
      : pearsonCorrelation(xs, ys);

  if (r === null || Number.isNaN(r)) {
    return null;
  }

  return { correlationValue: r, sampleSize: xs.length };
}

export function computeAllCorrelations(
  metrics: MetricSeriesInput[],
  timezone: string,
  options?: { minSample?: number },
): ComputedCorrelation[] {
  const minSample = options?.minSample ?? EXPLORATORY_MIN_CORRELATION_SAMPLE;
  const eligible = metrics.filter((m) => m.valueType !== 'category');
  const dailyByMetric = new Map<string, DailyPoint[]>();

  for (const metric of eligible) {
    dailyByMetric.set(
      metric.metricId,
      aggregateDailySeries(metric.observations, metric.valueType, timezone),
    );
  }

  const results: ComputedCorrelation[] = [];

  for (let i = 0; i < eligible.length; i += 1) {
    for (let j = i + 1; j < eligible.length; j += 1) {
      const metricA = eligible[i]!;
      const metricB = eligible[j]!;
      const seriesA = dailyByMetric.get(metricA.metricId)!;
      const seriesB = dailyByMetric.get(metricB.metricId)!;

      for (const lagDays of CORRELATION_LAG_DAYS) {
        for (const method of CORRELATION_METHODS) {
          const computed = correlatePair({ seriesA, seriesB, lagDays, method, minSample });
          if (!computed) {
            continue;
          }

          results.push({
            metricAId: metricA.metricId,
            metricBId: metricB.metricId,
            method,
            lagDays,
            sampleSize: computed.sampleSize,
            correlationValue: computed.correlationValue,
            strengthLabel: strengthLabelFromR(computed.correlationValue),
            sampleTier: sampleTier(computed.sampleSize),
            exploratory: computed.sampleSize < MIN_CORRELATION_SAMPLE,
          });
        }
      }
    }
  }

  return results;
}
