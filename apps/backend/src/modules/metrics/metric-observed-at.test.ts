import { describe, expect, it } from 'vitest';
import type { MetricCandidate } from './metric-extraction.schemas.js';
import {
  buildNarrativeOrderTimeline,
  recordedAtForEntryTimeline,
  resolveObservedAtForCandidates,
} from './metric-observed-at.js';

function candidate(partial: Partial<MetricCandidate> & Pick<MetricCandidate, 'candidate_key'>): MetricCandidate {
  return {
    title: partial.candidate_key,
    value_type: 'ordinal',
    value_number: 3,
    value_text: null,
    value_boolean: null,
    unit: null,
    scale_min: 1,
    scale_max: 5,
    evidence_text: 'test',
    confidence: 0.8,
    reasoning: null,
    observed_date: null,
    observed_at: null,
    observed_at_precision: null,
    narrative_order: null,
    tags: [],
    ...partial,
  };
}

describe('metric-observed-at', () => {
  it('uses explicit observed_at when provided', () => {
    const metrics = [
      candidate({
        candidate_key: 'wellbeing',
        observed_at: '2026-05-19T14:32:00.000Z',
        observed_at_precision: 'exact',
      }),
    ];

    const resolved = resolveObservedAtForCandidates({
      candidates: metrics,
      entryDate: new Date('2026-05-19T00:00:00.000Z'),
      recordedAt: new Date('2026-05-19T22:00:00.000Z'),
      timeZone: 'UTC',
    });

    expect(resolved.get(metrics[0]!)?.observedAt.toISOString()).toBe('2026-05-19T14:32:00.000Z');
    expect(resolved.get(metrics[0]!)?.observedAtPrecision).toBe('exact');
  });

  it('distributes narrative orders evenly between day start and recorded_at', () => {
    const entryDate = new Date('2026-05-19T00:00:00.000Z');
    const recordedAt = new Date('2026-05-19T22:00:00.000Z');
    const timeline = buildNarrativeOrderTimeline({
      maxNarrativeOrder: 3,
      entryDate,
      recordedAt,
      timeZone: 'UTC',
    });

    expect(timeline.get(1)?.toISOString()).toBe('2026-05-19T07:00:00.000Z');
    expect(timeline.get(3)?.toISOString()).toBe('2026-05-19T22:00:00.000Z');
    expect(timeline.get(2)?.getTime()).toBeGreaterThan(timeline.get(1)!.getTime());
    expect(timeline.get(2)?.getTime()).toBeLessThan(timeline.get(3)!.getTime());
  });

  it('assigns the same narrative timestamp to metrics sharing an order', () => {
    const metrics = [
      candidate({ candidate_key: 'breakfast_quality', narrative_order: 1 }),
      candidate({
        candidate_key: 'fast_food_breakfast',
        value_type: 'boolean',
        value_number: null,
        value_boolean: true,
        scale_min: null,
        scale_max: null,
        narrative_order: 1,
      }),
      candidate({ candidate_key: 'run_duration', narrative_order: 2 }),
    ];

    const resolved = resolveObservedAtForCandidates({
      candidates: metrics,
      entryDate: new Date('2026-05-19T00:00:00.000Z'),
      recordedAt: new Date('2026-05-19T20:00:00.000Z'),
      timeZone: 'UTC',
    });

    expect(resolved.get(metrics[0]!)?.observedAt.toISOString()).toBe(
      resolved.get(metrics[1]!)?.observedAt.toISOString(),
    );
    expect(resolved.get(metrics[0]!)?.observedAtPrecision).toBe('inferred');
    expect(resolved.get(metrics[2]!)?.observedAt.getTime()).toBeGreaterThan(
      resolved.get(metrics[0]!)!.observedAt.getTime(),
    );
  });

  it('ignores inferred observed_at and uses narrative timeline', () => {
    const metrics = [
      candidate({
        candidate_key: 'fast_food_breakfast',
        value_type: 'boolean',
        value_number: null,
        value_boolean: true,
        scale_min: null,
        scale_max: null,
        observed_at: '2026-05-23T12:31:53.156Z',
        observed_at_precision: 'inferred',
        narrative_order: 2,
      }),
    ];

    const resolved = resolveObservedAtForCandidates({
      candidates: metrics,
      entryDate: new Date('2026-05-23T00:00:00.000Z'),
      recordedAt: new Date('2026-05-23T20:00:00.000Z'),
      timeZone: 'UTC',
    });

    expect(resolved.get(metrics[0]!)?.observedAt.toISOString()).not.toBe('2026-05-23T12:31:53.156Z');
    expect(resolved.get(metrics[0]!)?.observedAtPrecision).toBe('inferred');
  });

  it('prefers observed_date over narrative timeline', () => {
    const metrics = [
      candidate({
        candidate_key: 'run_duration_minutes',
        value_type: 'number',
        value_number: 60,
        unit: 'min',
        scale_min: null,
        scale_max: null,
        observed_date: '2026-05-22',
        observed_at_precision: 'date_only',
        narrative_order: 1,
        evidence_text: 'час пробежал в парке',
      }),
    ];

    const resolved = resolveObservedAtForCandidates({
      candidates: metrics,
      entryDate: new Date('2026-05-23T00:00:00.000Z'),
      recordedAt: new Date('2026-05-23T12:57:51.818Z'),
      timeZone: 'UTC',
    });

    expect(resolved.get(metrics[0]!)?.observedAt.toISOString()).toBe('2026-05-22T12:00:00.000Z');
    expect(resolved.get(metrics[0]!)?.observedAtPrecision).toBe('date_only');
  });

  it('falls back to entry_date when no timeline hints are present', () => {
    const metrics = [candidate({ candidate_key: 'wellbeing' })];

    const resolved = resolveObservedAtForCandidates({
      candidates: metrics,
      entryDate: new Date('2026-01-15T00:00:00.000Z'),
      recordedAt: new Date('2026-05-26T12:00:00.000Z'),
      timeZone: 'UTC',
    });

    expect(resolved.get(metrics[0]!)?.observedAt.toISOString()).toBe('2026-01-15T12:00:00.000Z');
    expect(resolved.get(metrics[0]!)?.observedAtPrecision).toBe('date_only');
  });

  it('uses entry_date timeline end for backdated entries with narrative order', () => {
    const metrics = [candidate({ candidate_key: 'wellbeing', narrative_order: 1 })];

    const resolved = resolveObservedAtForCandidates({
      candidates: metrics,
      entryDate: new Date('2026-01-15T00:00:00.000Z'),
      recordedAt: recordedAtForEntryTimeline({
        entryDate: new Date('2026-01-15T00:00:00.000Z'),
        createdAt: new Date('2026-05-26T12:00:00.000Z'),
      }),
      timeZone: 'UTC',
    });

    expect(resolved.get(metrics[0]!)?.observedAt.toISOString()).toBe('2026-01-15T20:00:00.000Z');
  });
});
