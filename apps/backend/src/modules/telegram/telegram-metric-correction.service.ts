import { getConfig } from '@metrixify/config';
import { jsonContextPackToToon } from '@metrixify/llm-payload-codec';
import type { AppLocale, MetricObservationItem } from '@metrixify/shared-types';
import type { DiaryEntry, MetricDefinition, MetricObservation, TelegramConversationTurn } from '@prisma/client';
import { loadTelegramMetricCorrectionPrompt } from '../../ai/prompt-loader.js';
import { findDiaryEntryById } from '../entries/entry.repository.js';
import { reprocessEntryMetricsForUser } from '../entries/entry.service.js';
import { createOpenAiStructuredChatClient } from '../ai-gateway/openai-chat.client.js';
import type { StructuredChatClient } from '../ai-gateway/openai-chat.client.js';
import { toObservationItem } from '../metrics/metric.mapper.js';
import {
  listActiveMetricDefinitions,
  listObservationsByEntry,
} from '../metrics/metric.repository.js';
import { persistAddObservationFromCorrection } from '../metrics/metric-observation-persist.js';
import { patchObservationForUser, deleteObservationForUser, archiveMetricForUser } from '../metrics/metrics.service.js';
import { entryTextForProcessing } from '../summary/summary-context.js';
import type { UpdateObservationBody } from '../metrics/metrics.schemas.js';
import {
  buildTelegramMetricCorrectionContextPack,
  type TelegramMetricCorrectionContextPack,
} from './telegram-metric-correction-context.js';
import { telegramMetricCorrectionAiOutputSchema } from './telegram-metric-correction.schemas.js';
import {
  formatCorrectionAppliedReply,
  formatCorrectionAddedReply,
  formatCorrectionFailedReply,
  formatCorrectionNoEntryReply,
  formatCorrectionObservedAtReply,
  formatCorrectionRemovedReply,
  formatCorrectionArchivedReply,
  formatCorrectionReprocessedReply,
  formatCorrectionUnsupportedReply,
} from './telegram-routing-replies.js';
import type { TelegramMetricCorrectionAiOutput } from './telegram-metric-correction.schemas.js';
import {
  inferObservedDateFromCorrection,
  isDateOnlyCorrectionMessage,
} from './telegram-metric-correction-date.js';
import {
  findDefinitionMatchingMessageText,
  resolveRemoveObservationTarget,
} from './telegram-metric-correction-dialog.js';
import { isReprocessCorrectionMessage } from './telegram-metric-correction-reprocess.js';

export type ApplyTelegramMetricCorrectionInput = {
  userId: string;
  locale: AppLocale;
  userTimezone: string;
  entryId: string;
  messageText: string;
  replyToMessageId?: number | null;
  recentTurns?: TelegramConversationTurn[];
};

export type ApplyTelegramMetricCorrectionResult = {
  status: 'applied' | 'unsupported' | 'no_entry' | 'failed';
  entryId: string;
  entryDate: string | null;
  replyText: string;
  observations: MetricObservationItem[];
};

export type TelegramCorrectionDeps = {
  chat: StructuredChatClient;
};

export function createDefaultTelegramCorrectionDeps(): TelegramCorrectionDeps {
  return {
    chat: createOpenAiStructuredChatClient(),
  };
}

function entryTextPreview(entry: DiaryEntry): string | null {
  const text = entry.rawText ?? entry.transcriptText ?? entry.summaryText;
  return text?.trim().slice(0, 300) ?? null;
}

export async function buildCorrectionContextPackForEntry(
  entry: DiaryEntry,
  userId: string,
  locale: AppLocale,
  messageText: string,
  replyToMessageId?: number | null,
  recentTurns: TelegramConversationTurn[] = [],
): Promise<TelegramMetricCorrectionContextPack> {
  const [observations, existingMetrics] = await Promise.all([
    listObservationsByEntry(entry.id, userId),
    listActiveMetricDefinitions(userId),
  ]);
  return buildTelegramMetricCorrectionContextPack({
    messageText,
    replyToMessageId,
    recentTurns,
    entry: {
      id: entry.id,
      entryDate: entry.entryDate.toISOString().slice(0, 10),
      textPreview: entryTextPreview(entry),
    },
    existingMetrics,
    observations: observations.map((observation) =>
      toObservationItem(observation, locale),
    ),
  });
}

type CorrectionValueOutput = {
  value_boolean: boolean | null;
  value_number: number | null;
};

function coerceOrdinalFromBoolean(
  valueBoolean: boolean,
  definition: Pick<MetricDefinition, 'scaleMin' | 'scaleMax'>,
): number {
  const min = definition.scaleMin ?? 1;
  const max = definition.scaleMax ?? 5;
  return valueBoolean ? max : min;
}

export function buildPatchBodyForTarget(
  target: MetricObservation & { metricDefinition: MetricDefinition },
  output: CorrectionValueOutput,
): UpdateObservationBody | null {
  const body: UpdateObservationBody = {
    editedVia: 'telegram',
  };
  const valueType = target.metricDefinition.valueType;

  if (valueType === 'boolean') {
    if (output.value_boolean !== null) {
      body.valueBoolean = output.value_boolean;
      return body;
    }
    if (output.value_number !== null) {
      body.valueBoolean = output.value_number !== 0;
      return body;
    }
    return null;
  }

  if (valueType === 'ordinal' || valueType === 'number') {
    if (output.value_number !== null) {
      body.valueNumber = output.value_number;
      return body;
    }
    if (valueType === 'ordinal' && output.value_boolean !== null) {
      body.valueNumber = coerceOrdinalFromBoolean(
        output.value_boolean,
        target.metricDefinition,
      );
      return body;
    }
    return null;
  }

  return null;
}

type ObservedAtCorrectionOutput = Pick<
  TelegramMetricCorrectionAiOutput,
  'observed_at' | 'observed_date' | 'observed_at_precision'
>;

export function buildObservedAtPatchBody(
  output: ObservedAtCorrectionOutput,
): Pick<UpdateObservationBody, 'observedAt' | 'observedAtPrecision' | 'editedVia'> | null {
  if (output.observed_at) {
    const parsed = new Date(output.observed_at);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return {
      editedVia: 'telegram',
      observedAt: parsed.toISOString(),
      observedAtPrecision: output.observed_at_precision ?? 'exact',
    };
  }

  if (output.observed_date && /^\d{4}-\d{2}-\d{2}$/.test(output.observed_date)) {
    return {
      editedVia: 'telegram',
      observedAt: new Date(`${output.observed_date}T12:00:00.000Z`).toISOString(),
      observedAtPrecision: output.observed_at_precision ?? 'date_only',
    };
  }

  return null;
}

function resolveCorrectionTargets(
  observations: Array<MetricObservation & { metricDefinition: MetricDefinition }>,
  output: TelegramMetricCorrectionAiOutput,
): Array<MetricObservation & { metricDefinition: MetricDefinition }> {
  if (output.apply_to === 'all_on_entry') {
    return observations;
  }
  const target = observations.find((observation) => observation.id === output.observation_id);
  return target ? [target] : [];
}

function enrichObservedAtCorrectionOutput(
  output: TelegramMetricCorrectionAiOutput,
  messageText: string,
  entryDate: string,
): TelegramMetricCorrectionAiOutput {
  if (output.command !== 'fix_observed_at' && !isDateOnlyCorrectionMessage(messageText)) {
    return output;
  }

  const inferredDate = inferObservedDateFromCorrection(messageText, entryDate);
  if (!inferredDate) {
    return output;
  }

  return {
    ...output,
    command: 'fix_observed_at',
    apply_to: 'all_on_entry',
    observation_id: null,
    observed_date: output.observed_date ?? inferredDate,
    observed_at: output.observed_at,
    observed_at_precision: output.observed_at_precision ?? 'date_only',
    value_boolean: null,
    value_number: null,
  };
}

async function applyObservedAtCorrection(params: {
  observations: Array<MetricObservation & { metricDefinition: MetricDefinition }>;
  output: TelegramMetricCorrectionAiOutput;
  userId: string;
  entryId: string;
  locale: AppLocale;
  entryDate: string;
}): Promise<ApplyTelegramMetricCorrectionResult | null> {
  const patchBody = buildObservedAtPatchBody(params.output);
  if (!patchBody) {
    return null;
  }

  const targets = resolveCorrectionTargets(params.observations, params.output);
  if (targets.length === 0) {
    return null;
  }

  for (const target of targets) {
    await patchObservationForUser(target.id, params.userId, patchBody);
  }

  const refreshed = await listObservationsByEntry(params.entryId, params.userId);
  const refreshedItems = refreshed.map((observation) =>
    toObservationItem(observation, params.locale),
  );

  return {
    status: 'applied',
    entryId: params.entryId,
    entryDate: params.entryDate,
    replyText: formatCorrectionObservedAtReply(
      params.locale,
      patchBody.observedAt!,
      targets.length,
    ),
    observations: refreshedItems,
  };
}

async function resolveMetricDefinitionForArchive(
  output: TelegramMetricCorrectionAiOutput,
  messageText: string,
  observations: Array<MetricObservation & { metricDefinition: MetricDefinition }>,
  userId: string,
): Promise<MetricDefinition | null> {
  if (output.observation_id) {
    const fromObservation = observations.find(
      (observation) => observation.id === output.observation_id,
    );
    if (fromObservation) {
      return fromObservation.metricDefinition;
    }
  }

  const metricKey = output.metric_key?.trim();
  if (metricKey) {
    const fromEntryObservation = observations.find(
      (observation) => observation.metricDefinition.key === metricKey,
    );
    if (fromEntryObservation) {
      return fromEntryObservation.metricDefinition;
    }

    const activeMetrics = await listActiveMetricDefinitions(userId);
    const fromKey = activeMetrics.find((metric) => metric.key === metricKey);
    if (fromKey) {
      return fromKey;
    }
  }

  const activeMetrics = await listActiveMetricDefinitions(userId);
  const fromMessage = findDefinitionMatchingMessageText(messageText, activeMetrics);
  if (fromMessage) {
    return fromMessage;
  }

  const fromEntryMessage = findDefinitionMatchingMessageText(
    messageText,
    observations.map((observation) => observation.metricDefinition),
  );
  return fromEntryMessage;
}

async function applyReprocessCorrection(params: {
  entry: DiaryEntry;
  input: ApplyTelegramMetricCorrectionInput;
  observationItems: MetricObservationItem[];
}): Promise<ApplyTelegramMetricCorrectionResult> {
  const entryDate = params.entry.entryDate.toISOString().slice(0, 10);
  try {
    await reprocessEntryMetricsForUser(
      params.entry.id,
      params.input.userId,
      params.input.userTimezone,
    );
    const refreshed = await listObservationsByEntry(params.entry.id, params.input.userId);
    const refreshedItems = refreshed.map((observation) =>
      toObservationItem(observation, params.input.locale),
    );
    return {
      status: 'applied',
      entryId: params.entry.id,
      entryDate,
      replyText: formatCorrectionReprocessedReply(params.input.locale, refreshedItems),
      observations: refreshedItems,
    };
  } catch (error) {
    console.error('[telegram-correction] reprocess_entry failed', error);
    return {
      status: 'failed',
      entryId: params.entry.id,
      entryDate,
      replyText: formatCorrectionFailedReply(params.input.locale),
      observations: params.observationItems,
    };
  }
}

export async function applyTelegramMetricCorrection(
  input: ApplyTelegramMetricCorrectionInput,
  deps: TelegramCorrectionDeps = createDefaultTelegramCorrectionDeps(),
): Promise<ApplyTelegramMetricCorrectionResult> {
  const entry = await findDiaryEntryById(input.entryId, input.userId);
  if (!entry) {
    return {
      status: 'no_entry',
      entryId: input.entryId,
      entryDate: null,
      replyText: formatCorrectionNoEntryReply(input.locale),
      observations: [],
    };
  }

  const entryDate = entry.entryDate.toISOString().slice(0, 10);
  const observations = await listObservationsByEntry(entry.id, input.userId);
  const entryText = entryTextForProcessing(entry) ?? entryTextPreview(entry) ?? '';

  const config = getConfig();
  const model = config.OPENAI_EXTRACTION_MODEL;
  const prompt = loadTelegramMetricCorrectionPrompt();
  const contextPack = await buildCorrectionContextPackForEntry(
    entry,
    input.userId,
    input.locale,
    input.messageText,
    input.replyToMessageId,
    input.recentTurns ?? [],
  );
  const toonInput = jsonContextPackToToon(contextPack);
  const observationItems = observations.map((observation) =>
    toObservationItem(observation, input.locale),
  );

  try {
    const result = await deps.chat.completeStructured({
      model,
      messages: [
        { role: 'system', content: prompt.body },
        {
          role: 'user',
          content: `Parse the correction command. Context pack (TOON):\n\n${toonInput}`,
        },
      ],
      schema: telegramMetricCorrectionAiOutputSchema,
      schemaName: 'telegram_metric_correction',
    });

    if (result.data.command === 'unsupported') {
      if (isReprocessCorrectionMessage(input.messageText)) {
        return applyReprocessCorrection({ entry, input, observationItems });
      }
      return {
        status: 'unsupported',
        entryId: entry.id,
        entryDate,
        replyText: formatCorrectionUnsupportedReply(input.locale),
        observations: observationItems,
      };
    }

    const normalized = enrichObservedAtCorrectionOutput(
      result.data,
      input.messageText,
      entryDate,
    );

    if (normalized.command === 'fix_observed_at') {
      const applied = await applyObservedAtCorrection({
        observations,
        output: normalized,
        userId: input.userId,
        entryId: entry.id,
        locale: input.locale,
        entryDate,
      });
      if (applied) {
        return applied;
      }
      console.error('[telegram-correction] fix_observed_at could not be applied', {
        entryId: entry.id,
        llmCommand: result.data.command,
        normalized,
      });
      return {
        status: 'failed',
        entryId: entry.id,
        entryDate,
        replyText: formatCorrectionFailedReply(input.locale),
        observations: observationItems,
      };
    }

    if (normalized.command === 'add_observation') {
      try {
        const addResult = await persistAddObservationFromCorrection(
          {
            userId: input.userId,
            entry,
            entryText,
            correctionMessage: input.messageText,
            userTimezone: input.userTimezone,
            output: normalized,
          },
          observations,
        );
        const refreshed = await listObservationsByEntry(entry.id, input.userId);
        const refreshedItems = refreshed.map((observation) =>
          toObservationItem(observation, input.locale),
        );
        const addedItem = refreshedItems.find(
          (item) => item.id === addResult.observation.id,
        );

        return {
          status: 'applied',
          entryId: entry.id,
          entryDate,
          replyText: formatCorrectionAddedReply(
            input.locale,
            addedItem ??
              toObservationItem(addResult.observation, input.locale),
            addResult.created,
          ),
          observations: refreshedItems,
        };
      } catch (error) {
        console.error('[telegram-correction] add_observation failed', error);
        return {
          status: 'failed',
          entryId: entry.id,
          entryDate,
          replyText: formatCorrectionFailedReply(input.locale),
          observations: observationItems,
        };
      }
    }

    if (normalized.command === 'remove_observation') {
      const target = resolveRemoveObservationTarget(
        input.messageText,
        normalized.observation_id,
        observations,
        input.recentTurns ?? [],
        entry.id,
      );
      if (!target) {
        console.error('[telegram-correction] remove_observation target not found', {
          entryId: entry.id,
          observationId: normalized.observation_id,
        });
        return {
          status: 'failed',
          entryId: entry.id,
          entryDate,
          replyText: formatCorrectionFailedReply(input.locale),
          observations: observationItems,
        };
      }

      const removedTitle = toObservationItem(target, input.locale).metricTitle;
      try {
        await deleteObservationForUser(target.id, input.userId, {
          editedVia: 'telegram',
        });
      } catch (error) {
        console.error('[telegram-correction] remove_observation failed', error);
        return {
          status: 'failed',
          entryId: entry.id,
          entryDate,
          replyText: formatCorrectionFailedReply(input.locale),
          observations: observationItems,
        };
      }

      const refreshed = await listObservationsByEntry(entry.id, input.userId);
      const refreshedItems = refreshed.map((observation) =>
        toObservationItem(observation, input.locale),
      );

      return {
        status: 'applied',
        entryId: entry.id,
        entryDate,
        replyText: formatCorrectionRemovedReply(input.locale, removedTitle),
        observations: refreshedItems,
      };
    }

    if (normalized.command === 'archive_metric') {
      const definition = await resolveMetricDefinitionForArchive(
        normalized,
        input.messageText,
        observations,
        input.userId,
      );
      if (!definition) {
        console.error('[telegram-correction] archive_metric target not found', {
          entryId: entry.id,
          metricKey: normalized.metric_key,
          observationId: normalized.observation_id,
        });
        return {
          status: 'failed',
          entryId: entry.id,
          entryDate,
          replyText: formatCorrectionFailedReply(input.locale),
          observations: observationItems,
        };
      }

      try {
        await archiveMetricForUser(definition.id, input.userId, {
          editedVia: 'telegram',
          entryId: entry.id,
        });
      } catch (error) {
        console.error('[telegram-correction] archive_metric failed', error);
        return {
          status: 'failed',
          entryId: entry.id,
          entryDate,
          replyText: formatCorrectionFailedReply(input.locale),
          observations: observationItems,
        };
      }

      return {
        status: 'applied',
        entryId: entry.id,
        entryDate,
        replyText: formatCorrectionArchivedReply(input.locale, definition.title),
        observations: observationItems,
      };
    }

    if (normalized.command === 'reprocess_entry') {
      return applyReprocessCorrection({ entry, input, observationItems });
    }

    const target = observations.find(
      (observation) => observation.id === normalized.observation_id,
    );
    if (!target) {
      if (isDateOnlyCorrectionMessage(input.messageText)) {
        const dateFallback = enrichObservedAtCorrectionOutput(
          {
            ...normalized,
            command: 'fix_observed_at',
            apply_to: 'all_on_entry',
            observation_id: null,
            observed_at: null,
            observed_date: null,
            observed_at_precision: 'date_only',
            value_boolean: null,
            value_number: null,
            reasoning: normalized.reasoning,
          },
          input.messageText,
          entryDate,
        );
        const applied = await applyObservedAtCorrection({
          observations,
          output: dateFallback,
          userId: input.userId,
          entryId: entry.id,
          locale: input.locale,
          entryDate,
        });
        if (applied) {
          return applied;
        }
      }

      console.error('[telegram-correction] fix_value target not found', {
        entryId: entry.id,
        observationId: normalized.observation_id,
      });
      return {
        status: 'failed',
        entryId: entry.id,
        entryDate,
        replyText: formatCorrectionFailedReply(input.locale),
        observations: observationItems,
      };
    }

    const patchBody = buildPatchBodyForTarget(target, normalized);
    if (!patchBody) {
      if (isDateOnlyCorrectionMessage(input.messageText)) {
        const dateFallback = enrichObservedAtCorrectionOutput(
          {
            ...normalized,
            command: 'fix_observed_at',
            apply_to: 'all_on_entry',
            observation_id: null,
            observed_at: null,
            observed_date: null,
            observed_at_precision: 'date_only',
            value_boolean: null,
            value_number: null,
            reasoning: normalized.reasoning,
          },
          input.messageText,
          entryDate,
        );
        const applied = await applyObservedAtCorrection({
          observations,
          output: dateFallback,
          userId: input.userId,
          entryId: entry.id,
          locale: input.locale,
          entryDate,
        });
        if (applied) {
          return applied;
        }
      }

      console.error('[telegram-correction] fix_value patch body invalid', {
        entryId: entry.id,
        observationId: target.id,
        metricKey: target.metricDefinition.key,
      });
      return {
        status: 'failed',
        entryId: entry.id,
        entryDate,
        replyText: formatCorrectionFailedReply(input.locale),
        observations: observationItems,
      };
    }

    await patchObservationForUser(target.id, input.userId, patchBody);

    const refreshed = await listObservationsByEntry(entry.id, input.userId);
    const refreshedItems = refreshed.map((observation) =>
      toObservationItem(observation, input.locale),
    );
    const updated = refreshedItems.find((item) => item.id === target.id);

    return {
      status: 'applied',
      entryId: entry.id,
      entryDate,
      replyText: formatCorrectionAppliedReply(input.locale, updated ?? refreshedItems[0]!),
      observations: refreshedItems,
    };
  } catch (error) {
    console.error('[telegram-correction] failed to apply metric correction', error);
    return {
      status: 'failed',
      entryId: entry.id,
      entryDate,
      replyText: formatCorrectionFailedReply(input.locale),
      observations: observationItems,
    };
  }
}
