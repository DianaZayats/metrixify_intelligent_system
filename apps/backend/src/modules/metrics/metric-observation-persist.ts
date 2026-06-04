import type { DiaryEntry, MetricDefinition, MetricObservation } from '@prisma/client';
import type { MetricCandidate } from './metric-extraction.schemas.js';
import { isMetricGroundedInEntryText } from './metric-extraction-grounding.js';
import { ensureCandidateI18n } from './metric-i18n.js';
import {
  appendObservationAuditMetadata,
  snapshotObservation,
  validateObservationValuesForDefinition,
  type ObservationAuditRecord,
} from './metric-observation-audit.js';
import {
  assertCandidateHasValue,
  normalizeObservationValue,
  parseAliasesJson,
} from './metric-normalization.js';
import { fitOrdinalCandidateToScale } from './metric-rating-parse.js';
import { resolveObservedAtForCandidates, recordedAtForEntryTimeline } from './metric-observed-at.js';
import {
  createMetricObservation,
  ensureMetricDefinitionForCandidate,
  findMetricDefinitionByKeyAnyStatus,
  resolveMetricKey,
} from './metric.repository.js';
import { patchObservationForUser } from './metrics.service.js';
import type { TelegramMetricCorrectionAiOutput } from '../telegram/telegram-metric-correction.schemas.js';

export type PersistAddObservationInput = {
  userId: string;
  entry: DiaryEntry;
  entryText: string;
  correctionMessage: string;
  userTimezone: string;
  output: TelegramMetricCorrectionAiOutput;
};

export type PersistAddObservationResult = {
  observation: MetricObservation & { metricDefinition: MetricDefinition };
  created: boolean;
};

function combinedGroundingText(entryText: string, correctionMessage: string): string {
  return `${entryText.trim()}\n${correctionMessage.trim()}`.trim();
}

export function correctionOutputToCandidate(
  output: TelegramMetricCorrectionAiOutput,
): MetricCandidate | null {
  if (
    output.command !== 'add_observation' ||
    !output.metric_key?.trim() ||
    !output.title?.trim() ||
    !output.value_type ||
    !output.evidence_text?.trim()
  ) {
    return null;
  }

  return {
    candidate_key: output.metric_key.trim(),
    title: output.title.trim(),
    value_type: output.value_type,
    value_number: output.value_number,
    value_text: null,
    value_boolean: output.value_boolean,
    unit: output.unit,
    scale_min: output.scale_min,
    scale_max: output.scale_max,
    evidence_text: output.evidence_text.trim(),
    confidence: 0.85,
    reasoning: output.reasoning,
    observed_date: output.observed_date,
    observed_at: output.observed_at,
    observed_at_precision: output.observed_at_precision,
    narrative_order: null,
    tags: [],
  };
}

export async function persistAddObservationFromCorrection(
  input: PersistAddObservationInput,
  existingObservations: Array<MetricObservation & { metricDefinition: MetricDefinition }>,
): Promise<PersistAddObservationResult> {
  const candidate = correctionOutputToCandidate(input.output);
  if (!candidate) {
    throw new Error('Invalid add_observation output');
  }

  const groundingText = combinedGroundingText(input.entryText, input.correctionMessage);
  const key = resolveMetricKey(candidate);
  const existingDefinition = await findMetricDefinitionByKeyAnyStatus(input.userId, key);

  if (
    !isMetricGroundedInEntryText(
      candidate,
      groundingText,
      existingDefinition?.title,
      existingDefinition ? parseAliasesJson(existingDefinition.aliasesJson) : [],
    )
  ) {
    throw new Error('Add observation evidence is not grounded in entry or correction text');
  }

  const fitted = fitOrdinalCandidateToScale(candidate, groundingText);
  if (!fitted) {
    throw new Error('Ordinal value does not fit the metric scale');
  }

  const normalized = normalizeObservationValue(fitted);
  assertCandidateHasValue(fitted, normalized);
  const enriched = ensureCandidateI18n(fitted);

  const observedAtMap = resolveObservedAtForCandidates({
    candidates: [fitted],
    entryDate: input.entry.entryDate,
    recordedAt: recordedAtForEntryTimeline(input.entry),
    timeZone: input.userTimezone,
  });
  const resolved = observedAtMap.get(fitted);
  if (!resolved) {
    throw new Error('Could not resolve observed_at for add_observation');
  }

  const validationError = validateObservationValuesForDefinition(
    {
      valueType: fitted.value_type,
      scaleMin: fitted.scale_min,
      scaleMax: fitted.scale_max,
    },
    {
      valueNumber: normalized.valueNumber,
      valueText: normalized.valueText,
      valueBoolean: normalized.valueBoolean,
    },
  );
  if (validationError) {
    throw new Error(validationError);
  }

  const definition = await ensureMetricDefinitionForCandidate({
    userId: input.userId,
    entryId: input.entry.id,
    candidate: enriched,
    key,
  });

  const existingOnEntry = existingObservations.find(
    (observation) => observation.metricDefinition.key === key,
  );

  if (existingOnEntry) {
    const patchBody =
      candidate.value_type === 'boolean'
        ? { editedVia: 'telegram' as const, valueBoolean: normalized.valueBoolean! }
        : { editedVia: 'telegram' as const, valueNumber: normalized.valueNumber! };

    const updated = await patchObservationForUser(existingOnEntry.id, input.userId, patchBody);
    return {
      observation: updated,
      created: false,
    };
  }

  const editedAt = new Date().toISOString();
  const nextSnapshot = {
    valueNumber: normalized.valueNumber,
    valueText: normalized.valueText,
    valueBoolean: normalized.valueBoolean,
    observedAt: resolved.observedAt.toISOString(),
    evidenceText: fitted.evidence_text.trim(),
  };
  const auditRecord: ObservationAuditRecord = {
    action: 'create',
    source: 'user_correction',
    editedAt,
    editedVia: 'telegram',
    next: nextSnapshot,
    commandType: 'add_observation',
  };

  const observation = await createMetricObservation({
    userId: input.userId,
    entryId: input.entry.id,
    metricDefinitionId: definition.id,
    observedAt: resolved.observedAt,
    valueNumber: normalized.valueNumber,
    valueText: normalized.valueText,
    valueBoolean: normalized.valueBoolean,
    confidence: candidate.confidence,
    evidenceText: fitted.evidence_text.trim(),
    source: 'manual',
    metadataJson: appendObservationAuditMetadata(
      {
        candidateKey: key,
        observedAtPrecision: resolved.observedAtPrecision,
        ...(candidate.reasoning ? { reasoning: candidate.reasoning } : {}),
      },
      auditRecord,
    ),
  });

  return {
    observation: { ...observation, metricDefinition: definition },
    created: true,
  };
}
