import { getBackendUrl, getInternalApiKey } from '@metrixify/config';
import type {
  AppLocale,
  DiaryEntryListItem,
  TelegramCorrelationsSnapshotResponse,
  TelegramInsightsSnapshotResponse,
  TelegramLoginLinkResponse,
  TelegramMessageIngestResponse,
  TelegramRouteMessageResponse,
  TelegramUserLocaleResponse,
  TelegramVoiceIngestResponse,
} from '@metrixify/shared-types';

const INTERNAL_HEADER = 'x-metrixify-internal-key';

function baseUrl(): string {
  return getBackendUrl();
}

function internalHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    [INTERNAL_HEADER]: getInternalApiKey(),
  };
}

export type IngestPayload = {
  updateId: number;
  messageId: number;
  chatId: number;
  chatType: string;
  telegramUserId: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  languageCode?: string | null;
  text: string;
  replyToMessageId?: number | null;
};

export type VoiceIngestPayload = {
  updateId: number;
  messageId: number;
  chatId: number;
  chatType: string;
  telegramUserId: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  languageCode?: string | null;
  fileId: string;
  duration: number;
};

export async function ingestTelegramVoice(
  payload: VoiceIngestPayload,
): Promise<TelegramVoiceIngestResponse> {
  const response = await fetch(`${baseUrl()}/api/internal/telegram/voice`, {
    method: 'POST',
    headers: internalHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Backend voice ingest failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<TelegramVoiceIngestResponse>;
}

export async function routeTelegramMessage(
  payload: IngestPayload,
): Promise<TelegramRouteMessageResponse> {
  const response = await fetch(`${baseUrl()}/api/internal/telegram/message/route`, {
    method: 'POST',
    headers: internalHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Backend route failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<TelegramRouteMessageResponse>;
}

export async function ingestTelegramMessage(
  payload: IngestPayload,
): Promise<TelegramMessageIngestResponse> {
  const response = await fetch(`${baseUrl()}/api/internal/telegram/message`, {
    method: 'POST',
    headers: internalHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Backend ingest failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<TelegramMessageIngestResponse>;
}

export type LoginLinkPayload = {
  telegramUserId: number;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  languageCode?: string | null;
};

export async function requestLoginLink(
  payload: LoginLinkPayload,
): Promise<TelegramLoginLinkResponse> {
  const response = await fetch(`${baseUrl()}/api/internal/telegram/login-link`, {
    method: 'POST',
    headers: internalHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Backend login-link failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<TelegramLoginLinkResponse>;
}

export async function fetchRecentEntries(
  telegramUserId: number,
): Promise<DiaryEntryListItem[]> {
  const url = new URL(`${baseUrl()}/api/internal/telegram/status`);
  url.searchParams.set('telegramUserId', String(telegramUserId));

  const response = await fetch(url, { headers: internalHeaders() });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Backend status failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { items: DiaryEntryListItem[] };
  return data.items;
}

export async function fetchCorrelationsSnapshot(
  telegramUserId: number,
  limit = 5,
): Promise<TelegramCorrelationsSnapshotResponse> {
  const url = new URL(`${baseUrl()}/api/internal/telegram/correlations`);
  url.searchParams.set('telegramUserId', String(telegramUserId));
  url.searchParams.set('limit', String(limit));

  const response = await fetch(url, { headers: internalHeaders() });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Backend correlations snapshot failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<TelegramCorrelationsSnapshotResponse>;
}

export async function fetchInsightsSnapshot(
  telegramUserId: number,
): Promise<TelegramInsightsSnapshotResponse> {
  const url = new URL(`${baseUrl()}/api/internal/telegram/insights`);
  url.searchParams.set('telegramUserId', String(telegramUserId));

  const response = await fetch(url, { headers: internalHeaders() });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Backend insights snapshot failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<TelegramInsightsSnapshotResponse>;
}

export async function fetchUserLocale(telegramUserId: number): Promise<TelegramUserLocaleResponse> {
  const url = new URL(`${baseUrl()}/api/internal/telegram/user-locale`);
  url.searchParams.set('telegramUserId', String(telegramUserId));

  const response = await fetch(url, { headers: internalHeaders() });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Backend user-locale GET failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<TelegramUserLocaleResponse>;
}

export type AppendConversationTurnPayload = {
  telegramUserId: number;
  chatId: number;
  role: 'user' | 'bot';
  turnType:
    | 'diary_user'
    | 'diary_summary'
    | 'correction_user'
    | 'correction_ack'
    | 'system';
  text: string;
  telegramMessageId?: number | null;
  replyToMessageId?: number | null;
  entryId?: string | null;
};

export async function appendTelegramConversationTurn(
  payload: AppendConversationTurnPayload,
): Promise<void> {
  const response = await fetch(`${baseUrl()}/api/internal/telegram/conversation/turn`, {
    method: 'POST',
    headers: internalHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Backend conversation turn failed (${response.status}): ${body}`);
  }
}

export type SaveSummaryMessagePayload = {
  entryId: string;
  telegramUserId: number;
  chatId: number;
  inboundMessageId: number;
  summaryMessageId: number;
};

export async function saveTelegramSummaryMessage(
  payload: SaveSummaryMessagePayload,
): Promise<void> {
  const response = await fetch(
    `${baseUrl()}/api/internal/telegram/entries/${encodeURIComponent(payload.entryId)}/summary-message`,
    {
      method: 'PATCH',
      headers: internalHeaders(),
      body: JSON.stringify({
        telegramUserId: payload.telegramUserId,
        chatId: payload.chatId,
        inboundMessageId: payload.inboundMessageId,
        summaryMessageId: payload.summaryMessageId,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Backend summary-message PATCH failed (${response.status}): ${body}`);
  }
}

export type UpdateUserLocalePayload = {
  telegramUserId: number;
  locale: AppLocale;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  languageCode?: string | null;
};

export async function updateUserLocale(
  payload: UpdateUserLocalePayload,
): Promise<TelegramUserLocaleResponse> {
  const response = await fetch(`${baseUrl()}/api/internal/telegram/user-locale`, {
    method: 'PATCH',
    headers: internalHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Backend user-locale PATCH failed (${response.status}): ${body}`);
  }

  return response.json() as Promise<TelegramUserLocaleResponse>;
}
