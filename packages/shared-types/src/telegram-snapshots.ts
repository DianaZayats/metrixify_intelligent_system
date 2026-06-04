import type { InsightConfidence } from './insights.js';

export type TelegramCorrelationSnapshotItem = {
  metricATitle: string;
  metricBTitle: string;
  correlationValue: number;
  lagDays: number;
  sampleSize: number;
  exploratory: boolean;
};

export type TelegramCorrelationsSnapshotResponse = {
  items: TelegramCorrelationSnapshotItem[];
  total: number;
};

export type TelegramInsightSnapshotItem = {
  title: string;
  body: string;
  confidence: InsightConfidence;
};

export type TelegramRecommendationSnapshotItem = {
  title: string;
  body: string;
};

export type TelegramInsightsSnapshotResponse = {
  report: {
    generatedAt: string;
    insights: TelegramInsightSnapshotItem[];
    recommendations: TelegramRecommendationSnapshotItem[];
  } | null;
};
