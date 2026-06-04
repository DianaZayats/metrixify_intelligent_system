import type { ProcessingStatus } from './index.js';
import type { MetricObservationItem } from './metrics.js';

export type TelegramIngestResultFields = {
  processingStatus: ProcessingStatus;
  processingError: string | null;
  observations: MetricObservationItem[];
};

export type DiaryEntryListItem = {
  id: string;
  userId: string;
  sourceType: 'text' | 'voice' | 'manual';
  rawText: string | null;
  summaryText: string | null;
  entryDate: string;
  processingStatus: ProcessingStatus;
  createdAt: string;
};

export type DiaryEntryDetail = DiaryEntryListItem & {
  transcriptText: string | null;
  processingError: string | null;
  updatedAt: string;
  observations: MetricObservationItem[];
};

export type TelegramMessageIngestResponse = {
  entryId: string;
  created: boolean;
} & TelegramIngestResultFields;

export type TelegramVoiceIngestResponse = {
  entryId: string;
  created: boolean;
  transcribed: boolean;
} & TelegramIngestResultFields;

export type EntriesListResponse = {
  items: DiaryEntryListItem[];
  total: number;
  limit: number;
  offset: number;
};
