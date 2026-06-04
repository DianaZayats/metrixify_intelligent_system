import { ApiError } from '../../shared/errors/api-error.js';
import { prisma } from '../../shared/db/prisma.js';
import {
  appendDiaryEntryCorrectionAudit,
  archiveMetricDefinitionForUser,
  deleteMetricObservationForUser,
  findMetricDefinitionByIdForUser,
  findMetricObservationByIdForUser,
  listMetricDefinitionsWithStats,
  listObservationsByEntry,
  listObservationsForUser,
  updateMetricDefinitionForUser,
  updateMetricObservationForUser,
} from './metric.repository.js';
import type { UpdateMetricDefinitionBody } from './metric-schema-resolver.schemas.js';
import type { DeleteObservationBody, UpdateObservationBody, ArchiveMetricBody } from './metrics.schemas.js';
import {
  appendEntryCorrectionAudit,
  appendObservationAuditMetadata,
  snapshotObservation,
  validateObservationValuesForDefinition,
} from './metric-observation-audit.js';

export async function getMetricsForUser(userId: string) {
  return listMetricDefinitionsWithStats(userId);
}

export async function getMetricByIdForUser(id: string, userId: string) {
  const metric = await findMetricDefinitionByIdForUser(id, userId);
  if (!metric) {
    throw new ApiError(404, 'NOT_FOUND', 'Metric not found');
  }
  return metric;
}

export async function getObservationsForEntry(entryId: string, userId: string) {
  return listObservationsByEntry(entryId, userId);
}

export async function getObservationsForUser(
  userId: string,
  params?: { metricId?: string },
) {
  if (params?.metricId) {
    const metric = await findMetricDefinitionByIdForUser(params.metricId, userId);
    if (!metric) {
      throw new ApiError(404, 'NOT_FOUND', 'Metric not found');
    }
  }

  return listObservationsForUser(userId, {
    metricDefinitionId: params?.metricId,
  });
}

export async function updateMetricForUser(
  id: string,
  userId: string,
  body: UpdateMetricDefinitionBody,
) {
  const metric = await findMetricDefinitionByIdForUser(id, userId);
  if (!metric) {
    throw new ApiError(404, 'NOT_FOUND', 'Metric not found');
  }
  if (metric.status === 'archived') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Archived metrics cannot be edited');
  }

  return updateMetricDefinitionForUser({
    id,
    userId,
    title: body.title,
    description: body.description,
    aliases: body.aliases,
    tags: body.tags,
  });
}

export async function archiveMetricForUser(
  id: string,
  userId: string,
  body: ArchiveMetricBody = {},
) {
  const metric = await findMetricDefinitionByIdForUser(id, userId);
  if (!metric) {
    throw new ApiError(404, 'NOT_FOUND', 'Metric not found');
  }
  if (metric.status === 'archived') {
    return metric;
  }

  const archived = await archiveMetricDefinitionForUser(id, userId);
  const editedVia = body.editedVia ?? 'api';
  if (editedVia === 'telegram' && body.entryId) {
    const editedAt = new Date().toISOString();
    const entry = await prisma.diaryEntry.findFirst({
      where: { id: body.entryId, userId },
      select: { metadataJson: true },
    });

    if (entry) {
      await appendDiaryEntryCorrectionAudit({
        entryId: body.entryId,
        userId,
        metadataJson: appendEntryCorrectionAudit(entry.metadataJson, {
          action: 'archive',
          source: 'user_correction',
          editedAt,
          editedVia,
          metricDefinitionId: archived.id,
          metricKey: archived.key,
          metricTitle: archived.title,
          commandType: 'archive_metric',
        }),
      });
    }
  }

  return archived;
}

function mergeObservationMetadata(
  metadataJson: unknown,
  body: Pick<UpdateObservationBody, 'observedAtPrecision' | 'narrativeOrder'>,
): Record<string, unknown> {
  const base =
    metadataJson && typeof metadataJson === 'object' && !Array.isArray(metadataJson)
      ? { ...(metadataJson as Record<string, unknown>) }
      : {};

  if (body.observedAtPrecision !== undefined) {
    base.observedAtPrecision = body.observedAtPrecision;
  }
  if (body.narrativeOrder !== undefined) {
    base.narrativeOrder = body.narrativeOrder;
  }

  return base;
}

export async function patchObservationForUser(
  id: string,
  userId: string,
  body: UpdateObservationBody,
) {
  const observation = await findMetricObservationByIdForUser(id, userId);
  if (!observation) {
    throw new ApiError(404, 'NOT_FOUND', 'Observation not found');
  }

  const previous = snapshotObservation(observation);
  const editedAt = new Date().toISOString();
  const editedVia = body.editedVia ?? 'api';
  const auditSource = editedVia === 'telegram' ? 'user_correction' : 'manual';

  const nextValues = {
    valueNumber: body.valueNumber !== undefined ? body.valueNumber : observation.valueNumber,
    valueText: body.valueText !== undefined ? body.valueText : observation.valueText,
    valueBoolean: body.valueBoolean !== undefined ? body.valueBoolean : observation.valueBoolean,
    observedAt: body.observedAt ? new Date(body.observedAt) : observation.observedAt,
    evidenceText: body.evidenceText !== undefined ? body.evidenceText : observation.evidenceText,
  };

  const validationError = validateObservationValuesForDefinition(
    observation.metricDefinition,
    nextValues,
  );
  if (validationError) {
    throw new ApiError(400, 'VALIDATION_ERROR', validationError);
  }

  const mergedMetadata = mergeObservationMetadata(observation.metadataJson, body);
  const auditRecord = {
    action: 'update' as const,
    source: auditSource,
    editedAt,
    editedVia,
    previous,
    next: snapshotObservation({
      ...observation,
      ...nextValues,
    }),
  };

  const updated = await updateMetricObservationForUser({
    id,
    userId,
    valueNumber: body.valueNumber,
    valueText: body.valueText,
    valueBoolean: body.valueBoolean,
    observedAt: body.observedAt ? new Date(body.observedAt) : undefined,
    evidenceText: body.evidenceText,
    metadataJson: appendObservationAuditMetadata(mergedMetadata, auditRecord),
  });

  const refreshed = await findMetricObservationByIdForUser(updated.id, userId);
  if (!refreshed) {
    throw new ApiError(404, 'NOT_FOUND', 'Observation not found');
  }
  return refreshed;
}

export async function deleteObservationForUser(
  id: string,
  userId: string,
  body: DeleteObservationBody = {},
) {
  const observation = await findMetricObservationByIdForUser(id, userId);
  if (!observation) {
    throw new ApiError(404, 'NOT_FOUND', 'Observation not found');
  }

  const editedAt = new Date().toISOString();
  const editedVia = body.editedVia ?? 'api';
  const auditSource = editedVia === 'telegram' ? 'user_correction' : 'manual';
  const auditRecord = {
    action: 'delete' as const,
    source: auditSource,
    editedAt,
    editedVia,
    previous: snapshotObservation(observation),
    commandType: editedVia === 'telegram' ? 'remove_observation' : undefined,
  };

  const entry = await prisma.diaryEntry.findFirst({
    where: { id: observation.entryId, userId },
    select: { metadataJson: true },
  });

  if (entry) {
    await appendDiaryEntryCorrectionAudit({
      entryId: observation.entryId,
      userId,
      metadataJson: appendEntryCorrectionAudit(entry.metadataJson, {
        ...auditRecord,
        observationId: observation.id,
        metricDefinitionId: observation.metricDefinitionId,
      }),
    });
  }

  await deleteMetricObservationForUser(id, userId);
  return auditRecord;
}
