import type { UserExportResponse } from '@metrixify/shared-types';
import ExcelJS from 'exceljs';

type ColumnDef<T> = {
  header: string;
  key: keyof T & string;
  width?: number;
};

function profileFactValue(valueJson: unknown): string {
  if (valueJson && typeof valueJson === 'object' && !Array.isArray(valueJson)) {
    const text = (valueJson as Record<string, unknown>).text;
    if (typeof text === 'string') {
      return text;
    }
  }
  return valueJson == null ? '' : JSON.stringify(valueJson);
}

function jsonCell(value: unknown): string {
  if (value == null) {
    return '';
  }
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function addDataSheet<T extends Record<string, unknown>>(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  rows: T[],
  columns: ColumnDef<T>[],
): void {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width ?? 18,
  }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow(row);
  }
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

export async function buildUserExportXlsxBuffer(payload: UserExportResponse): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Metrixify';
  workbook.created = new Date(payload.exportedAt);

  const metricById = new Map(payload.metricDefinitions.map((def) => [def.id, def]));

  const about = workbook.addWorksheet('About');
  about.columns = [
    { header: 'Field', key: 'field', width: 22 },
    { header: 'Value', key: 'value', width: 48 },
  ];
  about.getRow(1).font = { bold: true };
  about.addRows([
    { field: 'exportedAt', value: payload.exportedAt },
    { field: 'formatVersion', value: String(payload.formatVersion) },
    { field: 'userId', value: payload.user.id },
    { field: 'timezone', value: payload.user.timezone },
    { field: 'locale', value: payload.user.locale },
    { field: 'userCreatedAt', value: payload.user.createdAt },
    {
      field: 'telegramUserId',
      value: payload.user.telegram?.telegramUserId ?? '',
    },
    { field: 'telegramUsername', value: payload.user.telegram?.username ?? '' },
  ]);

  addDataSheet(workbook, 'Entries', payload.entries, [
    { header: 'id', key: 'id', width: 28 },
    { header: 'entryDate', key: 'entryDate', width: 12 },
    { header: 'sourceType', key: 'sourceType', width: 10 },
    { header: 'processingStatus', key: 'processingStatus', width: 18 },
    { header: 'summaryText', key: 'summaryText', width: 40 },
    { header: 'rawText', key: 'rawText', width: 40 },
    { header: 'transcriptText', key: 'transcriptText', width: 40 },
    { header: 'createdAt', key: 'createdAt', width: 22 },
    { header: 'updatedAt', key: 'updatedAt', width: 22 },
  ]);

  addDataSheet(
    workbook,
    'Metrics',
    payload.metricDefinitions.map((def) => ({
      ...def,
      aliases: def.aliases.join('; '),
      tags: def.tags.join('; '),
    })),
    [
      { header: 'id', key: 'id', width: 28 },
      { header: 'key', key: 'key', width: 20 },
      { header: 'title', key: 'title', width: 24 },
      { header: 'description', key: 'description', width: 32 },
      { header: 'valueType', key: 'valueType', width: 12 },
      { header: 'unit', key: 'unit', width: 10 },
      { header: 'scaleMin', key: 'scaleMin', width: 10 },
      { header: 'scaleMax', key: 'scaleMax', width: 10 },
      { header: 'aliases', key: 'aliases', width: 24 },
      { header: 'tags', key: 'tags', width: 20 },
      { header: 'status', key: 'status', width: 10 },
      { header: 'createdAt', key: 'createdAt', width: 22 },
    ],
  );

  addDataSheet(
    workbook,
    'Observations',
    payload.observations.map((obs) => {
      const metric = metricById.get(obs.metricDefinitionId);
      return {
        id: obs.id,
        entryId: obs.entryId,
        metricKey: metric?.key ?? '',
        metricTitle: metric?.title ?? '',
        observedAt: obs.observedAt,
        valueNumber: obs.valueNumber,
        valueBoolean: obs.valueBoolean,
        valueText: obs.valueText,
        confidence: obs.confidence,
        evidenceText: obs.evidenceText,
        source: obs.source,
        createdAt: obs.createdAt,
      };
    }),
    [
      { header: 'id', key: 'id', width: 28 },
      { header: 'entryId', key: 'entryId', width: 28 },
      { header: 'metricKey', key: 'metricKey', width: 20 },
      { header: 'metricTitle', key: 'metricTitle', width: 24 },
      { header: 'observedAt', key: 'observedAt', width: 22 },
      { header: 'valueNumber', key: 'valueNumber', width: 12 },
      { header: 'valueBoolean', key: 'valueBoolean', width: 12 },
      { header: 'valueText', key: 'valueText', width: 24 },
      { header: 'confidence', key: 'confidence', width: 12 },
      { header: 'evidenceText', key: 'evidenceText', width: 32 },
      { header: 'source', key: 'source', width: 12 },
      { header: 'createdAt', key: 'createdAt', width: 22 },
    ],
  );

  addDataSheet(
    workbook,
    'ProfileFacts',
    payload.profileFacts.map((fact) => ({
      id: fact.id,
      key: fact.key,
      valueText: profileFactValue(fact.valueJson),
      factType: fact.factType,
      stability: fact.stability,
      confidence: fact.confidence,
      evidenceCount: fact.evidenceCount,
      status: fact.status,
      validFrom: fact.validFrom,
      validTo: fact.validTo,
      createdAt: fact.createdAt,
      updatedAt: fact.updatedAt,
    })),
    [
      { header: 'id', key: 'id', width: 28 },
      { header: 'key', key: 'key', width: 20 },
      { header: 'valueText', key: 'valueText', width: 36 },
      { header: 'factType', key: 'factType', width: 16 },
      { header: 'stability', key: 'stability', width: 12 },
      { header: 'confidence', key: 'confidence', width: 12 },
      { header: 'evidenceCount', key: 'evidenceCount', width: 14 },
      { header: 'status', key: 'status', width: 10 },
      { header: 'validFrom', key: 'validFrom', width: 22 },
      { header: 'validTo', key: 'validTo', width: 22 },
      { header: 'createdAt', key: 'createdAt', width: 22 },
      { header: 'updatedAt', key: 'updatedAt', width: 22 },
    ],
  );

  addDataSheet(
    workbook,
    'Correlations',
    payload.correlations.map((row) => {
      const metricA = metricById.get(row.metricAId);
      const metricB = metricById.get(row.metricBId);
      return {
        id: row.id,
        metricAKey: metricA?.key ?? '',
        metricATitle: metricA?.title ?? '',
        metricBKey: metricB?.key ?? '',
        metricBTitle: metricB?.title ?? '',
        method: row.method,
        lagDays: row.lagDays,
        sampleSize: row.sampleSize,
        correlationValue: row.correlationValue,
        strengthLabel: row.strengthLabel,
        calculatedAt: row.calculatedAt,
        metadataJson: jsonCell(row.metadataJson),
      };
    }),
    [
      { header: 'id', key: 'id', width: 28 },
      { header: 'metricAKey', key: 'metricAKey', width: 20 },
      { header: 'metricATitle', key: 'metricATitle', width: 24 },
      { header: 'metricBKey', key: 'metricBKey', width: 20 },
      { header: 'metricBTitle', key: 'metricBTitle', width: 24 },
      { header: 'method', key: 'method', width: 12 },
      { header: 'lagDays', key: 'lagDays', width: 10 },
      { header: 'sampleSize', key: 'sampleSize', width: 12 },
      { header: 'correlationValue', key: 'correlationValue', width: 16 },
      { header: 'strengthLabel', key: 'strengthLabel', width: 14 },
      { header: 'calculatedAt', key: 'calculatedAt', width: 22 },
      { header: 'metadataJson', key: 'metadataJson', width: 32 },
    ],
  );

  addDataSheet(
    workbook,
    'Insights',
    payload.insightReports.map((report) => ({
      id: report.id,
      locale: report.locale,
      generatedAt: report.generatedAt,
      model: report.model,
      promptVersion: report.promptVersion,
      correlationCalculatedAt: report.correlationCalculatedAt,
      disclaimer: report.disclaimer,
      insightsJson: jsonCell(report.insightsJson),
      recommendationsJson: jsonCell(report.recommendationsJson),
      inputSummaryJson: jsonCell(report.inputSummaryJson),
      createdAt: report.createdAt,
    })),
    [
      { header: 'id', key: 'id', width: 28 },
      { header: 'locale', key: 'locale', width: 8 },
      { header: 'generatedAt', key: 'generatedAt', width: 22 },
      { header: 'model', key: 'model', width: 16 },
      { header: 'promptVersion', key: 'promptVersion', width: 14 },
      { header: 'correlationCalculatedAt', key: 'correlationCalculatedAt', width: 22 },
      { header: 'disclaimer', key: 'disclaimer', width: 36 },
      { header: 'insightsJson', key: 'insightsJson', width: 40 },
      { header: 'recommendationsJson', key: 'recommendationsJson', width: 40 },
      { header: 'inputSummaryJson', key: 'inputSummaryJson', width: 32 },
      { header: 'createdAt', key: 'createdAt', width: 22 },
    ],
  );

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
