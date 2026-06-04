import type { UserExportResponse } from '@metrixify/shared-types';
import { prisma } from '../../shared/db/prisma.js';

function isoDate(value: Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.toISOString();
}

export async function exportUserDataForUser(userId: string): Promise<UserExportResponse> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      timezone: true,
      locale: true,
      createdAt: true,
      telegramAccounts: {
        select: {
          telegramUserId: true,
          username: true,
          firstName: true,
          languageCode: true,
        },
      },
    },
  });

  const [
    entries,
    metricDefinitions,
    observations,
    profileFacts,
    correlations,
    insightReports,
  ] = await Promise.all([
    prisma.diaryEntry.findMany({
      where: { userId },
      orderBy: { entryDate: 'asc' },
      select: {
        id: true,
        sourceType: true,
        rawText: true,
        transcriptText: true,
        summaryText: true,
        entryDate: true,
        processingStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.metricDefinition.findMany({
      where: { userId },
      orderBy: { title: 'asc' },
      select: {
        id: true,
        key: true,
        title: true,
        description: true,
        valueType: true,
        unit: true,
        scaleMin: true,
        scaleMax: true,
        aliasesJson: true,
        tagsJson: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.metricObservation.findMany({
      where: { userId },
      orderBy: { observedAt: 'asc' },
      select: {
        id: true,
        entryId: true,
        metricDefinitionId: true,
        observedAt: true,
        valueNumber: true,
        valueBoolean: true,
        valueText: true,
        confidence: true,
        evidenceText: true,
        source: true,
        createdAt: true,
      },
    }),
    prisma.profileFact.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        key: true,
        valueJson: true,
        factType: true,
        stability: true,
        confidence: true,
        evidenceCount: true,
        status: true,
        validFrom: true,
        validTo: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.correlationResult.findMany({
      where: { userId },
      orderBy: { calculatedAt: 'desc' },
      select: {
        id: true,
        metricAId: true,
        metricBId: true,
        method: true,
        lagDays: true,
        sampleSize: true,
        correlationValue: true,
        strengthLabel: true,
        calculatedAt: true,
        metadataJson: true,
      },
    }),
    prisma.insightReport.findMany({
      where: { userId },
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true,
        locale: true,
        insightsJson: true,
        recommendationsJson: true,
        disclaimer: true,
        inputSummaryJson: true,
        correlationCalculatedAt: true,
        model: true,
        promptVersion: true,
        generatedAt: true,
        createdAt: true,
      },
    }),
  ]);

  const telegram = user.telegramAccounts[0];

  return {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
    user: {
      id: user.id,
      timezone: user.timezone,
      locale: user.locale,
      createdAt: user.createdAt.toISOString(),
      telegram: telegram
        ? {
            telegramUserId: telegram.telegramUserId.toString(),
            username: telegram.username,
            firstName: telegram.firstName,
            languageCode: telegram.languageCode,
          }
        : null,
    },
    entries: entries.map((entry) => ({
      ...entry,
      entryDate: entry.entryDate.toISOString().slice(0, 10),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    })),
    metricDefinitions: metricDefinitions.map((def) => ({
      id: def.id,
      key: def.key,
      title: def.title,
      description: def.description,
      valueType: def.valueType,
      unit: def.unit,
      scaleMin: def.scaleMin,
      scaleMax: def.scaleMax,
      aliases: Array.isArray(def.aliasesJson) ? (def.aliasesJson as string[]) : [],
      tags: Array.isArray(def.tagsJson) ? (def.tagsJson as string[]) : [],
      status: def.status,
      createdAt: def.createdAt.toISOString(),
    })),
    observations: observations.map((obs) => ({
      ...obs,
      observedAt: obs.observedAt.toISOString(),
      createdAt: obs.createdAt.toISOString(),
    })),
    profileFacts: profileFacts.map((fact) => ({
      ...fact,
      validFrom: isoDate(fact.validFrom),
      validTo: isoDate(fact.validTo),
      createdAt: fact.createdAt.toISOString(),
      updatedAt: fact.updatedAt.toISOString(),
    })),
    correlations: correlations.map((row) => ({
      ...row,
      calculatedAt: row.calculatedAt.toISOString(),
    })),
    insightReports: insightReports.map((report) => ({
      id: report.id,
      locale: report.locale,
      insightsJson: report.insightsJson,
      recommendationsJson: report.recommendationsJson,
      disclaimer: report.disclaimer,
      inputSummaryJson: report.inputSummaryJson,
      correlationCalculatedAt: isoDate(report.correlationCalculatedAt),
      model: report.model,
      promptVersion: report.promptVersion,
      generatedAt: report.generatedAt.toISOString(),
      createdAt: report.createdAt.toISOString(),
    })),
  };
}
