import type { DashboardInsightsFeed } from './insights.js';

export const CORRELATION_METHODS = ['pearson', 'spearman'] as const;
export type CorrelationMethod = (typeof CORRELATION_METHODS)[number];

export const STRENGTH_LABELS = ['negligible', 'weak', 'moderate', 'strong'] as const;
export type StrengthLabel = (typeof STRENGTH_LABELS)[number];

export const SAMPLE_TIERS = ['low', 'medium', 'higher'] as const;
export type SampleTier = (typeof SAMPLE_TIERS)[number];

export type CorrelationListItem = {
  id: string;
  metricAId: string;
  metricAKey: string;
  metricATitle: string;
  metricBId: string;
  metricBKey: string;
  metricBTitle: string;
  method: CorrelationMethod;
  lagDays: number;
  sampleSize: number;
  correlationValue: number;
  strengthLabel: StrengthLabel;
  sampleTier: SampleTier;
  exploratory: boolean;
  calculatedAt: string;
};

export type CorrelationsListResponse = {
  items: CorrelationListItem[];
  heatmap: CorrelationHeatmap;
};

export type CorrelationHeatmap = {
  metricIds: string[];
  metricLabels: string[];
  values: Array<number | null>;
  /** Lag used per matrix cell (same length as `values`); populated when heatmap uses best lag per pair. */
  cellLagDays: Array<number | null>;
  method: CorrelationMethod;
  /** `null` when each pair may use a different lag (best |r| mode). */
  lagDays: number | null;
};

export type DailySeriesPoint = {
  date: string;
  value: number;
};

export type ScatterPoint = {
  x: number;
  y: number;
  date: string;
};

export type CorrelationDetail = {
  id: string;
  metricAId: string;
  metricAKey: string;
  metricATitle: string;
  metricBId: string;
  metricBKey: string;
  metricBTitle: string;
  method: CorrelationMethod;
  lagDays: number;
  sampleSize: number;
  correlationValue: number;
  alternateMethodValue: number | null;
  strengthLabel: StrengthLabel;
  sampleTier: SampleTier;
  calculatedAt: string;
  seriesA: DailySeriesPoint[];
  seriesB: DailySeriesPoint[];
  scatter: ScatterPoint[];
  relatedEntries: Array<{
    entryId: string;
    entryDate: string;
    summaryText: string | null;
  }>;
};

export type DashboardMetricCard = {
  id: string;
  key: string;
  title: string;
  valueType: string;
  observationCount: number;
  lastObservedAt: string | null;
  latestValueDisplay: string | null;
};

export type DashboardCorrelationHighlight = {
  id: string;
  metricATitle: string;
  metricBTitle: string;
  correlationValue: number;
  method: CorrelationMethod;
  lagDays: number;
  sampleSize: number;
  strengthLabel: StrengthLabel;
};

export type DashboardResponse = {
  entriesLast7Days: number;
  hasCorrelationResults: boolean;
  lastCalculatedAt: string | null;
  recentEntries: Array<{
    id: string;
    entryDate: string;
    summaryText: string | null;
    processingStatus: string;
  }>;
  topMetrics: DashboardMetricCard[];
  topCorrelations: DashboardCorrelationHighlight[];
  chartMetricId: string | null;
  chartSeries: DailySeriesPoint[];
  insightsFeed: DashboardInsightsFeed;
};

export type RecalculateResponse = {
  correlationCount: number;
  officialCount: number;
  exploratoryCount: number;
  calculatedAt: string;
};
