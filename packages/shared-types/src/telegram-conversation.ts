import type { TelegramMessageIngestResponse } from './entries.js';
import type { MetricObservationItem } from './metrics.js';

export const TELEGRAM_MESSAGE_KINDS = ['diary_entry', 'correction'] as const;
export type TelegramMessageKind = (typeof TELEGRAM_MESSAGE_KINDS)[number];

export const TELEGRAM_CORRECTION_STATUSES = [
  'applied',
  'unsupported',
  'no_entry',
  'failed',
] as const;
export type TelegramCorrectionStatus = (typeof TELEGRAM_CORRECTION_STATUSES)[number];

export type TelegramConversationTurnItem = {
  id: string;
  role: 'user' | 'bot';
  turnType:
    | 'diary_user'
    | 'diary_summary'
    | 'correction_user'
    | 'correction_ack'
    | 'system';
  text: string;
  telegramMessageId: number | null;
  replyToMessageId: number | null;
  entryId: string | null;
  createdAt: string;
};

export type TelegramCorrectionResponse = {
  kind: 'correction';
  entryId: string | null;
  entryDate: string | null;
  status: TelegramCorrectionStatus;
  replyText: string;
  observations: MetricObservationItem[];
};

export type TelegramDiaryIngestResponse = {
  kind: 'diary_entry';
} & TelegramMessageIngestResponse;

export type TelegramRouteMessageResponse =
  | TelegramDiaryIngestResponse
  | TelegramCorrectionResponse;

export type AppendTelegramConversationTurnPayload = {
  telegramUserId: number;
  chatId: number;
  role: 'user' | 'bot';
  turnType: TelegramConversationTurnItem['turnType'];
  text: string;
  telegramMessageId?: number | null;
  replyToMessageId?: number | null;
  entryId?: string | null;
};

/** @deprecated use TelegramCorrectionResponse */
export type TelegramCorrectionStubResponse = TelegramCorrectionResponse;
