import { describe, expect, it } from 'vitest';
import type { UserExportResponse } from '@metrixify/shared-types';
import ExcelJS from 'exceljs';
import { buildUserExportXlsxBuffer } from './user-export-xlsx.service.js';

const samplePayload: UserExportResponse = {
  exportedAt: '2026-05-29T12:00:00.000Z',
  formatVersion: 1,
  user: {
    id: 'user-1',
    timezone: 'Europe/Kyiv',
    locale: 'uk',
    createdAt: '2026-01-01T00:00:00.000Z',
    telegram: {
      telegramUserId: '123',
      username: 'demo',
      firstName: 'Demo',
      languageCode: 'uk',
    },
  },
  entries: [
    {
      id: 'entry-1',
      sourceType: 'text',
      rawText: 'Hello diary',
      transcriptText: null,
      summaryText: 'Summary',
      entryDate: '2026-05-20',
      processingStatus: 'completed',
      createdAt: '2026-05-20T10:00:00.000Z',
      updatedAt: '2026-05-20T10:05:00.000Z',
    },
  ],
  metricDefinitions: [
    {
      id: 'metric-1',
      key: 'mood',
      title: 'Mood',
      description: null,
      valueType: 'ordinal',
      unit: null,
      scaleMin: 1,
      scaleMax: 5,
      aliases: ['wellbeing'],
      tags: ['mood'],
      status: 'active',
      createdAt: '2026-05-20T10:00:00.000Z',
    },
  ],
  observations: [
    {
      id: 'obs-1',
      entryId: 'entry-1',
      metricDefinitionId: 'metric-1',
      observedAt: '2026-05-20T10:00:00.000Z',
      valueNumber: 4,
      valueBoolean: null,
      valueText: null,
      confidence: 0.9,
      evidenceText: 'felt good',
      source: 'ai',
      createdAt: '2026-05-20T10:05:00.000Z',
    },
  ],
  profileFacts: [
    {
      id: 'fact-1',
      key: 'job_title',
      valueJson: { text: 'Developer' },
      factType: 'work',
      stability: 'stable',
      confidence: 0.9,
      evidenceCount: 2,
      status: 'active',
      validFrom: null,
      validTo: null,
      createdAt: '2026-05-20T10:00:00.000Z',
      updatedAt: '2026-05-20T10:00:00.000Z',
    },
  ],
  correlations: [],
  insightReports: [],
};

describe('buildUserExportXlsxBuffer', () => {
  it('builds a workbook with expected sheets and row counts', async () => {
    const buffer = await buildUserExportXlsxBuffer(samplePayload);
    expect(buffer.subarray(0, 2).toString('utf8')).toBe('PK');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'About',
      'Entries',
      'Metrics',
      'Observations',
      'ProfileFacts',
      'Correlations',
      'Insights',
    ]);
    expect(workbook.getWorksheet('Entries')?.rowCount).toBe(2);
    const observationRow = workbook.getWorksheet('Observations')?.getRow(2);
    expect(observationRow?.getCell(3).value).toBe('mood');
    expect(workbook.getWorksheet('ProfileFacts')?.getRow(2).getCell(3).value).toBe(
      'Developer',
    );
  });
});
