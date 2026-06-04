export type CorrelationRow = {
  id: string;
  metricAKey: string;
  metricBKey: string;
  method: 'pearson' | 'spearman';
  lagDays: number;
  sampleSize: number;
  correlationValue: number;
};

export type ExpectedCheck = {
  status: 'FOUND' | 'NOT FOUND';
  label: string;
  detail: string;
  required: boolean;
};

export type ExtraCorrelation = {
  label: string;
  detail: string;
};

export type VerifyReport = {
  expectedChecks: ExpectedCheck[];
  extras: ExtraCorrelation[];
  pairsComputed: number;
  pairsAboveThreshold: number;
  failedRequired: number;
};

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

export function findMatchingCorrelation(
  rows: CorrelationRow[],
  metricA: string,
  metricB: string,
  method: 'pearson' | 'spearman',
  lagDays: number,
): CorrelationRow | null {
  return (
    rows.find(
      (row) =>
        row.method === method &&
        row.lagDays === lagDays &&
        pairKey(row.metricAKey, row.metricBKey) === pairKey(metricA, metricB),
    ) ?? null
  );
}

export function findBestCorrelationForPair(
  rows: CorrelationRow[],
  metricA: string,
  metricB: string,
): CorrelationRow | null {
  const matches = rows.filter(
    (row) => pairKey(row.metricAKey, row.metricBKey) === pairKey(metricA, metricB),
  );
  if (matches.length === 0) {
    return null;
  }
  return matches.sort(
    (a, b) => Math.abs(b.correlationValue) - Math.abs(a.correlationValue),
  )[0]!;
}

export function verifyCorrelations(params: {
  rows: CorrelationRow[];
  required: Array<{
    metric_a: string;
    metric_b: string;
    method: 'pearson' | 'spearman';
    lag_days: number;
    min_r: number;
    min_sample: number;
  }>;
  optional: Array<{
    metric_a: string;
    metric_b: string;
    method: 'pearson' | 'spearman';
    lag_days: number;
    min_r: number;
    min_sample: number;
  }>;
  extraThreshold: number;
}): VerifyReport {
  const expectedChecks: ExpectedCheck[] = [];

  for (const item of params.required) {
    const label = `${item.metric_a} ↔ ${item.metric_b} (lag ${item.lag_days}, ${item.method})`;
    const match = findMatchingCorrelation(
      params.rows,
      item.metric_a,
      item.metric_b,
      item.method,
      item.lag_days,
    );

    if (
      match &&
      match.sampleSize >= item.min_sample &&
      match.correlationValue >= item.min_r
    ) {
      expectedChecks.push({
        status: 'FOUND',
        label,
        detail: `r=${match.correlationValue.toFixed(2)}, n=${match.sampleSize}`,
        required: true,
      });
    } else {
      const best = findBestCorrelationForPair(params.rows, item.metric_a, item.metric_b);
      const detail = best
        ? `NOT FOUND (best |r|=${Math.abs(best.correlationValue).toFixed(2)}, n=${best.sampleSize}, lag=${best.lagDays}, ${best.method})`
        : 'NOT FOUND (no pair in results)';
      expectedChecks.push({
        status: 'NOT FOUND',
        label,
        detail,
        required: true,
      });
    }
  }

  for (const item of params.optional) {
    const label = `${item.metric_a} ↔ ${item.metric_b} (lag ${item.lag_days}, ${item.method})`;
    const match = findMatchingCorrelation(
      params.rows,
      item.metric_a,
      item.metric_b,
      item.method,
      item.lag_days,
    );

    if (
      match &&
      match.sampleSize >= item.min_sample &&
      match.correlationValue >= item.min_r
    ) {
      expectedChecks.push({
        status: 'FOUND',
        label,
        detail: `r=${match.correlationValue.toFixed(2)}, n=${match.sampleSize}`,
        required: false,
      });
    } else {
      const best = findBestCorrelationForPair(params.rows, item.metric_a, item.metric_b);
      const detail = best
        ? `NOT FOUND (best |r|=${Math.abs(best.correlationValue).toFixed(2)}, n=${best.sampleSize}, lag=${best.lagDays}, ${best.method})`
        : 'NOT FOUND (no pair in results)';
      expectedChecks.push({
        status: 'NOT FOUND',
        label,
        detail,
        required: false,
      });
    }
  }

  const extras: ExtraCorrelation[] = [];
  for (const row of params.rows) {
    if (Math.abs(row.correlationValue) < params.extraThreshold) {
      continue;
    }
    const key = `${pairKey(row.metricAKey, row.metricBKey)}::${row.method}::${row.lagDays}`;
    const isExpected = [...params.required, ...params.optional].some(
      (item) =>
        pairKey(item.metric_a, item.metric_b) === pairKey(row.metricAKey, row.metricBKey) &&
        item.method === row.method &&
        item.lag_days === row.lagDays,
    );
    if (isExpected) {
      continue;
    }
    extras.push({
      label: `${row.metricAKey} ↔ ${row.metricBKey} (lag ${row.lagDays}, ${row.method})`,
      detail: `r=${row.correlationValue.toFixed(2)}, n=${row.sampleSize}`,
    });
  }

  extras.sort((a, b) => b.detail.localeCompare(a.detail));

  const failedRequired = expectedChecks.filter((c) => c.required && c.status === 'NOT FOUND').length;

  return {
    expectedChecks,
    extras,
    pairsComputed: params.rows.length,
    pairsAboveThreshold: params.rows.filter((r) => Math.abs(r.correlationValue) >= params.extraThreshold)
      .length,
    failedRequired,
  };
}
