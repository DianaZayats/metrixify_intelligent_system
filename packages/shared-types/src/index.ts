export const PROCESSING_STATUSES = [
  'received',
  'transcribing',
  'transcribed',
  'summarizing',
  'extracting_metrics',
  'resolving_schema',
  'extracting_facts',
  'saving_results',
  'completed',
  'failed',
] as const;

export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const METRIC_VALUE_TYPES = ['number', 'ordinal', 'boolean', 'category'] as const;
export type MetricValueType = (typeof METRIC_VALUE_TYPES)[number];

/** Value types allowed during AI metric extraction (analytics-ready only). */
export const METRIC_EXTRACTION_VALUE_TYPES = ['number', 'ordinal', 'boolean'] as const;
export type MetricExtractionValueType = (typeof METRIC_EXTRACTION_VALUE_TYPES)[number];

export const PROFILE_FACT_TYPES = [
  'work',
  'health_context',
  'routine',
  'preference',
  'habit',
  'goal',
  'constraint',
  'personal_context',
] as const;

export type ProfileFactType = (typeof PROFILE_FACT_TYPES)[number];

export type HealthResponse = {
  status: 'ok' | 'degraded';
  checks: {
    database: 'ok' | 'error';
    redis: 'ok' | 'skipped' | 'error';
  };
};

export type VersionResponse = {
  name: string;
  version: string;
  environment: string;
};

export type {
  DiaryEntryListItem,
  DiaryEntryDetail,
  TelegramMessageIngestResponse,
  TelegramVoiceIngestResponse,
  EntriesListResponse,
} from './entries.js';

export type {
  AppendTelegramConversationTurnPayload,
  TelegramConversationTurnItem,
  TelegramCorrectionResponse,
  TelegramCorrectionStatus,
  TelegramDiaryIngestResponse,
  TelegramMessageKind,
  TelegramRouteMessageResponse,
} from './telegram-conversation.js';
export {
  TELEGRAM_MESSAGE_KINDS,
  TELEGRAM_CORRECTION_STATUSES,
} from './telegram-conversation.js';

export type {
  AuthUser,
  AuthMeResponse,
  AuthTelegramTokenResponse,
  TelegramLoginLinkResponse,
  TelegramUserLocaleResponse,
  UpdateUserLocalePayload,
  UpdateUserLocaleResponse,
} from './auth.js';

export type { DeleteUserDataPayload, DeleteUserDataResponse } from './user.js';
export type { UserExportResponse } from './user-export.js';

export type {
  MetricDefinitionListItem,
  MetricObservationItem,
  MetricObservationsResponse,
  MetricsListResponse,
} from './metrics.js';

export type {
  ProfileFactListItem,
  ProfileFactsListResponse,
  UpdateProfileFactPayload,
} from './profile-facts.js';

export type { ProfileFactReliability } from './profile-fact-reliability.js';
export {
  PROFILE_FACT_LIKELY_MIN_CONFIDENCE,
  PROFILE_FACT_LIKELY_MIN_EVIDENCE,
  PROFILE_FACT_RELIABILITY_LEVELS,
  classifyProfileFactReliability,
} from './profile-fact-reliability.js';

export type {
  CorrelationDetail,
  CorrelationHeatmap,
  CorrelationListItem,
  CorrelationMethod,
  CorrelationsListResponse,
  DailySeriesPoint,
  DashboardCorrelationHighlight,
  DashboardMetricCard,
  DashboardResponse,
  RecalculateResponse,
  SampleTier,
  ScatterPoint,
  StrengthLabel,
} from './analytics.js';

export type {
  DashboardInsightsFeed,
  GenerateInsightsResponse,
  InsightConfidence,
  InsightItem,
  InsightReportDetail,
  InsightReportSummary,
  InsightsListResponse,
  LatestInsightsResponse,
  RecommendationItem,
} from './insights.js';

export {
  INSIGHT_CONFIDENCE_LEVELS,
} from './insights.js';

export {
  CORRELATION_METHODS,
  SAMPLE_TIERS,
  STRENGTH_LABELS,
} from './analytics.js';

export { SUGGESTED_METRIC_TAGS } from './metric-tags.js';
export type { SuggestedMetricTag } from './metric-tags.js';

export {
  APP_LOCALES,
  isAppLocale,
  parseLocalizedString,
  parseTagsI18nMap,
  resolveLocalized,
  resolveTagLabel,
} from './i18n.js';
export type { AppLocale, LocalizedString, TagsI18nMap } from './i18n.js';

export type {
  TelegramCorrelationSnapshotItem,
  TelegramCorrelationsSnapshotResponse,
  TelegramInsightSnapshotItem,
  TelegramInsightsSnapshotResponse,
  TelegramRecommendationSnapshotItem,
} from './telegram-snapshots.js';
