import type { MetricDefinition, TelegramConversationTurn } from '@prisma/client';
import type { MetricObservationItem } from '@metrixify/shared-types';
import { parseAliasesJson } from '../metrics/metric-normalization.js';
import type { TelegramMetricCorrectionContextPack } from './telegram-metric-correction.schemas.js';
import { parseMetricTitleFromCorrectionAck } from './telegram-metric-correction-dialog.js';

export function buildTelegramMetricCorrectionContextPack(input: {
  messageText: string;
  replyToMessageId?: number | null;
  recentTurns?: TelegramConversationTurn[];
  entry: {
    id: string;
    entryDate: string;
    textPreview: string | null;
  };
  existingMetrics: MetricDefinition[];
  observations: MetricObservationItem[];
}): TelegramMetricCorrectionContextPack {
  const recentTurns = input.recentTurns ?? [];
  const lastAck = recentTurns.find(
    (turn) =>
      turn.turnType === 'correction_ack' &&
      turn.role === 'bot' &&
      turn.entryId === input.entry.id,
  );

  return {
    schema_version: '1',
    user_message: {
      text: input.messageText.trim(),
      reply_to_message_id: input.replyToMessageId ?? null,
    },
    entry: {
      id: input.entry.id,
      entry_date: input.entryDate,
      text_preview: input.textPreview,
    },
    recent_conversation: recentTurns.slice(0, 8).map((turn) => ({
      role: turn.role,
      turn_type: turn.turnType,
      text: turn.text.slice(0, 300),
      entry_id: turn.entryId,
    })),
    last_corrected_metric_title: lastAck
      ? parseMetricTitleFromCorrectionAck(lastAck.text)
      : null,
    existing_metrics: input.existingMetrics.map((metric) => ({
      key: metric.key,
      title: metric.title,
      value_type: metric.valueType,
      aliases: parseAliasesJson(metric.aliasesJson),
    })),
    observations: input.observations.map((observation) => ({
      id: observation.id,
      metric_key: observation.metricKey,
      title: observation.metricTitle,
      value_type: observation.valueType,
      unit: observation.unit,
      scale_min: observation.scaleMin,
      scale_max: observation.scaleMax,
      value_boolean: observation.valueBoolean,
      value_number: observation.valueNumber,
      value_display: observation.valueDisplay,
      observed_at: observation.observedAt,
    })),
  };
}
