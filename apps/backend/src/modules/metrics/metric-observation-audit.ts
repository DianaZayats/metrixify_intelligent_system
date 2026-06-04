import type { MetricDefinition, MetricObservation, Prisma } from '@prisma/client';

export type ObservationEditVia = 'api' | 'telegram' | 'system';

export type ObservationValueSnapshot = {
  valueNumber: number | null;
  valueText: string | null;
  valueBoolean: boolean | null;
  observedAt: string;
  evidenceText: string | null;
};

export type ObservationAuditRecord = {
  action: 'create' | 'update' | 'delete' | 'archive';
  source: 'manual' | 'user_correction';
  editedAt: string;
  editedVia: ObservationEditVia;
  previous?: ObservationValueSnapshot;
  next?: ObservationValueSnapshot;
  intentRaw?: string;
  commandType?: string;
};

export function snapshotObservation(
  observation: Pick<
    MetricObservation,
    'valueNumber' | 'valueText' | 'valueBoolean' | 'observedAt' | 'evidenceText'
  >,
): ObservationValueSnapshot {
  return {
    valueNumber: observation.valueNumber,
    valueText: observation.valueText,
    valueBoolean: observation.valueBoolean,
    observedAt: observation.observedAt.toISOString(),
    evidenceText: observation.evidenceText,
  };
}

function parseMetadataRecord(metadataJson: unknown): Record<string, unknown> {
  if (!metadataJson || typeof metadataJson !== 'object' || Array.isArray(metadataJson)) {
    return {};
  }
  return { ...(metadataJson as Record<string, unknown>) };
}

export function appendObservationAuditMetadata(
  metadataJson: unknown,
  record: ObservationAuditRecord,
): Prisma.InputJsonValue {
  const metadata = parseMetadataRecord(metadataJson);
  const existingAudit = metadata.audit;
  const history = Array.isArray(existingAudit)
    ? [...existingAudit]
    : existingAudit && typeof existingAudit === 'object' && !Array.isArray(existingAudit)
      ? [
          ...(Array.isArray((existingAudit as { history?: unknown }).history)
            ? ((existingAudit as { history: ObservationAuditRecord[] }).history ?? [])
            : []),
        ]
      : [];

  history.push(record);

  return {
    ...metadata,
    audit: {
      source: 'manual',
      editedAt: record.editedAt,
      editedVia: record.editedVia,
      lastEdit: {
        action: record.action,
        previous: record.previous,
        next: record.next ?? null,
      },
      history,
    },
  } as Prisma.InputJsonValue;
}

export function appendEntryCorrectionAudit(
  metadataJson: unknown,
  record: ObservationAuditRecord & {
    metricDefinitionId: string;
    observationId?: string;
    metricKey?: string;
    metricTitle?: string;
  },
): Prisma.InputJsonValue {
  const metadata = parseMetadataRecord(metadataJson);
  const corrections = Array.isArray(metadata.correctionAudit)
    ? [...(metadata.correctionAudit as unknown[])]
    : [];

  corrections.push({
    observationId: record.observationId ?? null,
    metricDefinitionId: record.metricDefinitionId,
    metricKey: record.metricKey ?? null,
    metricTitle: record.metricTitle ?? null,
    action: record.action,
    source: record.source,
    editedAt: record.editedAt,
    editedVia: record.editedVia,
    previous: record.previous ?? null,
    next: record.next ?? null,
    commandType: record.commandType ?? null,
  });

  return {
    ...metadata,
    correctionAudit: corrections,
  } as Prisma.InputJsonValue;
}

export function validateObservationValuesForDefinition(
  definition: Pick<MetricDefinition, 'valueType' | 'scaleMin' | 'scaleMax'>,
  values: Pick<MetricObservation, 'valueNumber' | 'valueText' | 'valueBoolean'>,
): string | null {
  switch (definition.valueType) {
    case 'boolean':
      if (values.valueBoolean === null) {
        return 'Boolean observations require valueBoolean';
      }
      if (values.valueNumber !== null || values.valueText !== null) {
        return 'Boolean observations cannot include numeric or text values';
      }
      return null;
    case 'category':
      if (!values.valueText?.trim()) {
        return 'Category observations require valueText';
      }
      if (values.valueNumber !== null || values.valueBoolean !== null) {
        return 'Category observations cannot include numeric or boolean values';
      }
      return null;
    case 'ordinal': {
      if (values.valueNumber === null) {
        return 'Ordinal observations require valueNumber';
      }
      const min = definition.scaleMin ?? 1;
      const max = definition.scaleMax ?? 5;
      if (values.valueNumber < min || values.valueNumber > max) {
        return `Ordinal value must be between ${min} and ${max}`;
      }
      if (values.valueText !== null || values.valueBoolean !== null) {
        return 'Ordinal observations cannot include text or boolean values';
      }
      return null;
    }
    case 'number':
      if (values.valueNumber === null) {
        return 'Numeric observations require valueNumber';
      }
      if (values.valueText !== null || values.valueBoolean !== null) {
        return 'Numeric observations cannot include text or boolean values';
      }
      return null;
    default:
      return 'Unsupported metric value type';
  }
}
