import type { DiaryEntry, TelegramConversationTurn } from '@prisma/client';
import type { TelegramMessageRoutingContextPack } from './telegram-message-routing.schemas.js';

export type RecentEntryRoutingContext = {
  id: string;
  entryDate: string;
  rawTextPreview: string | null;
  summaryMessageId: number | null;
  inboundMessageId: number | null;
  metricTitles: string[];
  processingStatus: string;
};

function parseTelegramMetadata(entry: DiaryEntry): {
  summaryMessageId: number | null;
  inboundMessageId: number | null;
} {
  const metadata = entry.metadataJson;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return { summaryMessageId: null, inboundMessageId: null };
  }
  const telegram = (metadata as Record<string, unknown>).telegram;
  if (!telegram || typeof telegram !== 'object' || Array.isArray(telegram)) {
    return { summaryMessageId: null, inboundMessageId: null };
  }
  const record = telegram as Record<string, unknown>;
  const summaryRaw = record.summaryMessageId;
  const inboundRaw = record.inboundMessageId;
  return {
    summaryMessageId:
      typeof summaryRaw === 'string' || typeof summaryRaw === 'number'
        ? Number(summaryRaw)
        : null,
    inboundMessageId:
      typeof inboundRaw === 'string' || typeof inboundRaw === 'number'
        ? Number(inboundRaw)
        : null,
  };
}

export function buildRecentEntryRoutingContexts(
  entries: Array<
    DiaryEntry & {
      metricObservations?: Array<{ metricDefinition: { title: string } }>;
    }
  >,
): RecentEntryRoutingContext[] {
  return entries.map((entry) => {
    const telegram = parseTelegramMetadata(entry);
    const text = entry.rawText ?? entry.transcriptText;
    return {
      id: entry.id,
      entryDate: entry.entryDate.toISOString().slice(0, 10),
      rawTextPreview: text?.trim().slice(0, 200) ?? null,
      summaryMessageId: telegram.summaryMessageId,
      inboundMessageId: telegram.inboundMessageId,
      metricTitles:
        entry.metricObservations?.map((observation) => observation.metricDefinition.title) ??
        [],
      processingStatus: entry.processingStatus,
    };
  });
}

export function buildTelegramMessageRoutingContextPack(input: {
  text: string;
  replyToMessageId?: number | null;
  replyEntryId?: string | null;
  recentTurns: TelegramConversationTurn[];
  recentEntries: RecentEntryRoutingContext[];
}): TelegramMessageRoutingContextPack {
  return {
    schema_version: '1',
    incoming_message: {
      text: input.text.trim(),
      reply_to_message_id: input.replyToMessageId ?? null,
      reply_target_entry_id: input.replyEntryId ?? null,
    },
    recent_conversation: input.recentTurns.map((turn) => ({
      role: turn.role,
      turn_type: turn.turnType,
      text: turn.text,
      entry_id: turn.entryId,
      created_at: turn.createdAt.toISOString(),
    })),
    recent_entries: input.recentEntries.map((entry) => ({
      id: entry.id,
      entry_date: entry.entryDate,
      text_preview: entry.rawTextPreview,
      metric_titles: entry.metricTitles,
      processing_status: entry.processingStatus,
    })),
  };
}
