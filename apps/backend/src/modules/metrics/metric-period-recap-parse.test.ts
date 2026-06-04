import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  extractPeriodRecapBooleanCandidates,
  parseNutsFromClause,
  parsePeriodRecapLines,
  parseRashFromClause,
  reconcilePeriodRecapCandidates,
} from './metric-period-recap-parse.js';
import type { MetricCandidate } from './metric-extraction.schemas.js';

const PEANUT_RECAP = readFileSync(
  join(
    process.cwd(),
    '../../fixtures/personas/peanut-rash-quick/diary/2026-01-12.md',
  ),
  'utf8',
).trim();

/** Cyrillic «Вч» + Latin «ora» — deterministic parser skips; LLM should fill the gap. */
const HOMOGLYPH_VCHORA = 'В\u0447\u006F\u0072\u0061';

const ME05_TEXT =
  `Підсумок тижня. У понеділок — перекусив горіхами, ввечері помітив висип на шкірі. У середу — перекусив горіхами, ввечері помітив висип на шкірі. У п'ятницю — без горіхів і без висипу. ${HOMOGLYPH_VCHORA} — перекусив горіхами, без висипу.`;

function booleanCandidate(params: {
  key: string;
  observedDate: string;
  value: boolean;
  evidence?: string;
}): MetricCandidate {
  return {
    candidate_key: params.key,
    title: params.key,
    value_type: 'boolean',
    value_number: null,
    value_text: null,
    value_boolean: params.value,
    unit: null,
    scale_min: null,
    scale_max: null,
    evidence_text: params.evidence ?? params.key,
    confidence: 0.8,
    reasoning: null,
    observed_date: params.observedDate,
    observed_at: null,
    observed_at_precision: 'date_only',
    narrative_order: null,
    tags: [],
  };
}

describe('metric-period-recap-parse', () => {
  it('parses explicit Ukrainian calendar lines from peanut-rash weekly recap', () => {
    const entryDate = new Date('2026-01-12T12:00:00.000Z');
    const lines = parsePeriodRecapLines(PEANUT_RECAP, entryDate);

    expect(lines.map((line) => line.observedDate)).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-05',
      '2026-01-10',
      '2026-01-12',
    ]);
  });

  it('derives independent nuts and rash booleans per clause', () => {
    expect(parseNutsFromClause('перекусив горіхами, без висипу')).toBe(true);
    expect(parseRashFromClause('перекусив горіхами, без висипу')).toBe(false);
    expect(parseNutsFromClause('без горіхів, але був висип')).toBe(false);
    expect(parseRashFromClause('без горіхів, але був висип')).toBe(true);
  });

  it('extracts paired boolean metrics for every dated line', () => {
    const entryDate = new Date('2026-01-12T12:00:00.000Z');
    const candidates = extractPeriodRecapBooleanCandidates(PEANUT_RECAP, entryDate);

    expect(candidates).toHaveLength(12);
    expect(
      candidates.filter((candidate) => candidate.candidate_key === 'nuts_consumed' && candidate.value_boolean),
    ).toHaveLength(2);
    expect(
      candidates.find(
        (candidate) =>
          candidate.candidate_key === 'nuts_consumed' &&
          candidate.observed_date === '2026-01-01' &&
          candidate.value_boolean === true,
      )?.evidence_text,
    ).toContain('1 січня');
  });

  it('parses relative yesterday lines in weekly period recap', () => {
    const text =
      'Підсумок періоду (запис 4/5, фіксую 7 лютого). Вчора — перекусив горіхами, ввечері помітив висип на шкірі.';
    const entryDate = new Date('2026-02-07T12:00:00.000Z');
    const lines = parsePeriodRecapLines(text, entryDate);

    expect(lines).toEqual([
      {
        observedDate: '2026-02-06',
        clause: 'перекусив горіхами, ввечері помітив висип на шкірі',
        lineText: 'Вчора — перекусив горіхами, ввечері помітив висип на шкірі.',
      },
    ]);
  });

  it('parses weekday-relative lines from Підсумок тижня (ME-05)', () => {
    const entryDate = new Date('2026-05-29T12:00:00.000Z');
    const lines = parsePeriodRecapLines(ME05_TEXT, entryDate);

    expect(lines.map((line) => line.observedDate)).toEqual([
      '2026-05-25',
      '2026-05-27',
      '2026-05-29',
    ]);
  });

  it('keeps LLM yesterday rows when deterministic misses homoglyph typo', () => {
    const entryDate = new Date('2026-05-29T12:00:00.000Z');
    const llm: MetricCandidate[] = [
      booleanCandidate({
        key: 'nuts_consumed',
        observedDate: '2026-05-28',
        value: true,
        evidence: 'перекусив горіхами, без висипу',
      }),
      booleanCandidate({
        key: 'skin_rash_occurred',
        observedDate: '2026-05-28',
        value: false,
        evidence: 'без висипу',
      }),
    ];

    const reconciled = reconcilePeriodRecapCandidates(llm, ME05_TEXT, entryDate);
    const may28 = reconciled.filter((candidate) => candidate.observed_date === '2026-05-28');

    expect(may28).toHaveLength(2);
    expect(
      may28.find((candidate) => candidate.candidate_key === 'nuts_consumed')?.value_boolean,
    ).toBe(true);
    expect(reconciled.filter((candidate) => candidate.candidate_key === 'nuts_consumed')).toHaveLength(4);
  });

  it('prefers explicit date in weekday parens over entry-week weekday', () => {
    const text = 'Підсумок періоду. У суботу (10 січня) — без горіхів і без висипу.';
    const entryDate = new Date('2026-01-12T12:00:00.000Z');
    const lines = parsePeriodRecapLines(text, entryDate);

    expect(lines).toEqual([
      {
        observedDate: '2026-01-10',
        clause: 'без горіхів і без висипу',
        lineText: 'У суботу (10 січня) — без горіхів і без висипу.',
      },
    ]);
  });

  it('replaces LLM boolean bleed with deterministic period recap values', () => {
    const entryDate = new Date('2026-01-12T12:00:00.000Z');
    const wrongLlm: MetricCandidate[] = [
      {
        candidate_key: 'nuts_consumed',
        title: 'Nuts consumed',
        value_type: 'boolean',
        value_number: null,
        value_text: null,
        value_boolean: false,
        unit: null,
        scale_min: null,
        scale_max: null,
        evidence_text: 'без висипу',
        confidence: 0.7,
        reasoning: null,
        observed_date: '2026-01-01',
        observed_at: null,
        observed_at_precision: 'date_only',
        narrative_order: null,
        tags: ['nutrition'],
      },
    ];

    const reconciled = reconcilePeriodRecapCandidates(wrongLlm, PEANUT_RECAP, entryDate);
    const jan1Nuts = reconciled.find(
      (candidate) =>
        candidate.candidate_key === 'nuts_consumed' && candidate.observed_date === '2026-01-01',
    );

    expect(jan1Nuts?.value_boolean).toBe(true);
    expect(jan1Nuts?.evidence_text).toContain('перекусив горіхами');
  });
});
