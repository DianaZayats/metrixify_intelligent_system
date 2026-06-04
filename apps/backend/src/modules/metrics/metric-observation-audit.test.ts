import { describe, expect, it } from 'vitest';
import {
  appendObservationAuditMetadata,
  snapshotObservation,
  validateObservationValuesForDefinition,
} from './metric-observation-audit.js';

describe('metric-observation-audit', () => {
  it('builds audit metadata with previous and next snapshots', () => {
    const previous = {
      valueNumber: 2,
      valueText: null,
      valueBoolean: null,
      observedAt: new Date('2026-05-19T12:00:00.000Z'),
      evidenceText: 'before',
    };
    const next = {
      ...previous,
      valueNumber: 4,
      evidenceText: 'after',
    };

    const metadata = appendObservationAuditMetadata(
      { observedAtPrecision: 'date_only' },
      {
        action: 'update',
        source: 'manual',
        editedAt: '2026-05-19T13:00:00.000Z',
        editedVia: 'api',
        previous: snapshotObservation(previous),
        next: snapshotObservation(next),
      },
    ) as {
      observedAtPrecision: string;
      audit: { source: string; history: unknown[]; lastEdit: { previous: { valueNumber: number } } };
    };

    expect(metadata.observedAtPrecision).toBe('date_only');
    expect(metadata.audit.source).toBe('manual');
    expect(metadata.audit.history).toHaveLength(1);
    expect(metadata.audit.lastEdit.previous.valueNumber).toBe(2);
  });

  it('validates ordinal range', () => {
    const error = validateObservationValuesForDefinition(
      { valueType: 'ordinal', scaleMin: 1, scaleMax: 5 },
      { valueNumber: 6, valueText: null, valueBoolean: null },
    );
    expect(error).toContain('between 1 and 5');
  });
});
