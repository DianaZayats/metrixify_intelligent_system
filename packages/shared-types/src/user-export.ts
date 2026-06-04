export type UserExportResponse = {
  exportedAt: string;
  formatVersion: 1;
  user: {
    id: string;
    timezone: string;
    locale: string;
    createdAt: string;
    telegram: {
      telegramUserId: string;
      username: string | null;
      firstName: string | null;
      languageCode: string | null;
    } | null;
  };
  entries: Array<{
    id: string;
    sourceType: string;
    rawText: string | null;
    transcriptText: string | null;
    summaryText: string | null;
    entryDate: string;
    processingStatus: string;
    createdAt: string;
    updatedAt: string;
  }>;
  metricDefinitions: Array<{
    id: string;
    key: string;
    title: string;
    description: string | null;
    valueType: string;
    unit: string | null;
    scaleMin: number | null;
    scaleMax: number | null;
    aliases: string[];
    tags: string[];
    status: string;
    createdAt: string;
  }>;
  observations: Array<{
    id: string;
    entryId: string;
    metricDefinitionId: string;
    observedAt: string;
    valueNumber: number | null;
    valueBoolean: boolean | null;
    valueText: string | null;
    confidence: number | null;
    evidenceText: string | null;
    source: string;
    createdAt: string;
  }>;
  profileFacts: Array<{
    id: string;
    key: string;
    valueJson: unknown;
    factType: string;
    stability: string;
    confidence: number;
    evidenceCount: number;
    status: string;
    validFrom: string | null;
    validTo: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  correlations: Array<{
    id: string;
    metricAId: string;
    metricBId: string;
    method: string;
    lagDays: number;
    sampleSize: number;
    correlationValue: number;
    strengthLabel: string;
    calculatedAt: string;
    metadataJson: unknown;
  }>;
  insightReports: Array<{
    id: string;
    locale: string;
    insightsJson: unknown;
    recommendationsJson: unknown;
    disclaimer: string | null;
    inputSummaryJson: unknown;
    correlationCalculatedAt: string | null;
    model: string;
    promptVersion: string;
    generatedAt: string;
    createdAt: string;
  }>;
};
