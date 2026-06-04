export const INSIGHT_CONFIDENCE_LEVELS = ['high', 'medium', 'exploratory'] as const;
export type InsightConfidence = (typeof INSIGHT_CONFIDENCE_LEVELS)[number];

export type InsightItem = {
  id: string;
  title: string;
  body: string;
  confidence: InsightConfidence;
  correlationIds: string[];
};

export type RecommendationItem = {
  id: string;
  title: string;
  body: string;
  relatedInsightIds: string[];
};

export type InsightReportSummary = {
  id: string;
  locale: string;
  generatedAt: string;
  correlationCalculatedAt: string | null;
  insightCount: number;
  recommendationCount: number;
  model: string;
  promptVersion: string;
};

export type InsightReportDetail = {
  id: string;
  locale: string;
  generatedAt: string;
  correlationCalculatedAt: string | null;
  insights: InsightItem[];
  recommendations: RecommendationItem[];
  disclaimer: string | null;
  inputSummary: {
    profileFactCount: number;
    correlationCount: number;
  };
  model: string;
  promptVersion: string;
};

export type GenerateInsightsResponse = {
  report: InsightReportDetail;
};

export type LatestInsightsResponse = {
  report: InsightReportDetail | null;
};

export type InsightsListResponse = {
  items: InsightReportDetail[];
  total: number;
};

export type DashboardInsightsFeed = {
  hasReports: boolean;
  latestGeneratedAt: string | null;
  reports: InsightReportDetail[];
};
