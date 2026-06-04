import type { MetricValueType } from './index.js';

export type MetricDefinitionListItem = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  valueType: MetricValueType;
  unit: string | null;
  scaleMin: number | null;
  scaleMax: number | null;
  aliases: string[];
  tags: string[];
  status: 'active' | 'archived';
  observationCount: number;
  lastObservedAt: string | null;
  createdAt: string;
};

export type MetricObservationItem = {
  id: string;
  entryId: string;
  metricDefinitionId: string;
  metricKey: string;
  metricTitle: string;
  valueType: MetricValueType;
  unit: string | null;
  scaleMin: number | null;
  scaleMax: number | null;
  valueNumber: number | null;
  valueText: string | null;
  valueBoolean: boolean | null;
  valueDisplay: string;
  confidence: number | null;
  evidenceText: string | null;
  observedAt: string;
  observedAtPrecision: 'exact' | 'inferred' | 'date_only' | null;
  narrativeOrder: number | null;
  createdAt: string;
};

export type MetricObservationsResponse = {
  items: MetricObservationItem[];
};

export type MetricsListResponse = {
  items: MetricDefinitionListItem[];
};
