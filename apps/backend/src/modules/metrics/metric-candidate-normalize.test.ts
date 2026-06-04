import { describe, expect, it } from 'vitest';
import type { MetricCandidate } from './metric-extraction.schemas.js';
import {
  assignNarrativeOrdersByEvidence,
  isCrossDayEntry,
  isRecapStyleEntry,
  normalizeExtractionCandidates,
} from './metric-candidate-normalize.js';

function baseCandidate(partial: Partial<MetricCandidate> & Pick<MetricCandidate, 'candidate_key'>): MetricCandidate {
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
    observed_at: '2026-05-23T12:00:00.000Z',
    observed_at_precision: 'exact',
    narrative_order: 1,
    tags: [],
    ...partial,
  };
}

describe('metric-candidate-normalize', () => {
  it('remaps sleep_quality about daytime nap with total duration', () => {
    const entryText = 'потом два раза лёг поспать по минут сорок';
    const result = normalizeExtractionCandidates(
      [
        baseCandidate({
          candidate_key: 'sleep_quality',
          value_number: 2,
          evidence_text: 'два раза лёг поспать по минут сорок',
        }),
      ],
      entryText,
    );

    const keys = result.map((item) => item.candidate_key);
    expect(keys).toContain('daytime_nap_occurred');
    expect(keys).toContain('daytime_nap_duration_minutes');
    expect(keys).not.toContain('sleep_quality');
    expect(result.find((item) => item.candidate_key === 'daytime_nap_duration_minutes')?.value_number).toBe(
      80,
    );
  });

  it('remaps gym duration misclassified as nap evidence', () => {
    const result = normalizeExtractionCandidates(
      [
        baseCandidate({
          candidate_key: 'gym_session_duration_minutes',
          value_type: 'number',
          value_number: 80,
          unit: 'min',
          scale_min: null,
          scale_max: null,
          evidence_text: 'два раза лёг поспать по минут сорок',
        }),
      ],
      'Итог дня. Потом два раза лёг поспать по минут сорок.',
    );

    const keys = result.map((item) => item.candidate_key);
    expect(keys).toContain('daytime_nap_occurred');
    expect(keys).toContain('daytime_nap_duration_minutes');
    expect(keys).not.toContain('gym_session_duration_minutes');
    expect(result.find((item) => item.candidate_key === 'daytime_nap_duration_minutes')?.value_number).toBe(
      80,
    );
  });

  it('remaps generic productivity for pet project', () => {
    const result = normalizeExtractionCandidates(
      [
        baseCandidate({
          candidate_key: 'productivity',
          evidence_text: 'на pet-проекте был очень продуктивен',
        }),
      ],
      'text',
    );

    expect(result[0]?.candidate_key).toBe('personal_project_productivity');
  });

  it('assigns distinct narrative orders for recap entries', () => {
    const entryText =
      'Итог дня. Утром проснулся. Позавтракал бургерами. Потом пробежал. Вечером pet project.';
    const candidates = [
      baseCandidate({ candidate_key: 'wake_time_quality', evidence_text: 'Утром проснулся' }),
      baseCandidate({ candidate_key: 'fast_food_breakfast', evidence_text: 'Позавтракал бургерами' }),
      baseCandidate({ candidate_key: 'run_duration_minutes', evidence_text: 'Потом пробежал' }),
    ];

    expect(isRecapStyleEntry(entryText, candidates)).toBe(true);

    const normalized = assignNarrativeOrdersByEvidence(candidates, entryText);
    const orders = normalized.map((item) => item.narrative_order);
    expect(new Set(orders).size).toBe(3);
    expect(normalized.every((item) => item.observed_at === null)).toBe(true);
    expect(normalized.every((item) => item.observed_at_precision === 'inferred')).toBe(true);
  });

  it('detects cross-day markers at Cyrillic sentence boundaries without observed_date hints', () => {
    const entryText =
      'Вчера вечером час пробежал в парке. Сегодня утром 45 минут был в зале.';
    expect(isCrossDayEntry(entryText, [])).toBe(true);
  });

  it('does not treat cross-day workout entry as recap', () => {
    const entryText =
      'Вчера вечером час пробежал в парке. Сегодня утром 45 минут был в зале. Самочувствие после — 4 из 5';
    const candidates = [
      baseCandidate({
        candidate_key: 'run_duration_minutes',
        value_type: 'number',
        value_number: 60,
        unit: 'min',
        scale_min: null,
        scale_max: null,
        observed_date: '2026-05-22',
        observed_at_precision: 'date_only',
        evidence_text: 'час пробежал в парке',
      }),
      baseCandidate({
        candidate_key: 'gym_session_duration_minutes',
        value_type: 'number',
        value_number: 45,
        unit: 'min',
        scale_min: null,
        scale_max: null,
        observed_date: '2026-05-23',
        observed_at_precision: 'date_only',
        evidence_text: '45 минут был в зале',
      }),
      baseCandidate({
        candidate_key: 'wellbeing',
        evidence_text: 'Самочувствие после — 4 из 5',
      }),
    ];

    expect(isCrossDayEntry(entryText, candidates)).toBe(true);
    expect(isRecapStyleEntry(entryText, candidates)).toBe(false);

    const normalized = normalizeExtractionCandidates(candidates, entryText);
    expect(normalized.every((item) => item.narrative_order === null)).toBe(true);
    expect(normalized[0]?.observed_date).toBe('2026-05-22');
    expect(normalized[1]?.observed_date).toBe('2026-05-23');
  });

  it('adds nap duration from entry text when LLM only returned occurred', () => {
    const entryText =
      'Итог дня. Потом два раза лёг поспать по минут сорок. После этого работал на pet-проекте.';
    const result = normalizeExtractionCandidates(
      [
        baseCandidate({
          candidate_key: 'daytime_nap_occurred',
          value_type: 'boolean',
          value_number: null,
          value_boolean: true,
          scale_min: null,
          scale_max: null,
          evidence_text: 'лёг поспать по минут сорок',
        }),
      ],
      entryText,
    );

    expect(result.find((item) => item.candidate_key === 'daytime_nap_duration_minutes')?.value_number).toBe(
      80,
    );
  });

  it('drops junk count metrics without explicit number in evidence', () => {
    const result = normalizeExtractionCandidates(
      [
        baseCandidate({
          candidate_key: 'number_of_items_worked_on',
          value_type: 'number',
          value_number: 0,
          unit: null,
          scale_min: null,
          scale_max: null,
          evidence_text: 'на основной работе уже нет',
        }),
        baseCandidate({
          candidate_key: 'main_job_productivity',
          evidence_text: 'не очень продуктивно поработал на основной работе',
        }),
      ],
      'Итог дня.',
    );

    const keys = result.map((item) => item.candidate_key);
    expect(keys).not.toContain('number_of_items_worked_on');
    expect(keys).toContain('main_job_productivity');
  });

  it('remaps misclassified energy metric when evidence is about anxiety', () => {
    const entryText =
      'День робочий, без сильної тривожності. Симптоми 3 із 10.';
    const result = normalizeExtractionCandidates(
      [
        baseCandidate({
          candidate_key: 'acute_energy_level',
          value_type: 'ordinal',
          scale_max: 5,
          value_number: 2,
          evidence_text: 'без сильної тривожності',
        }),
      ],
      entryText,
    );

    expect(result.some((item) => item.candidate_key === 'stress_level')).toBe(true);
    expect(result.some((item) => item.candidate_key === 'acute_energy_level')).toBe(false);
  });

  it('adds stress metric when entry mentions low anxiety but LLM omitted it', () => {
    const entryText =
      'День 24 (2026-03-24): Симптоми 3 із 10. День робочий, без сильної тривожності.';
    const result = normalizeExtractionCandidates(
      [
        baseCandidate({
          candidate_key: 'evening_discomfort',
          scale_max: 10,
          value_number: 3,
          evidence_text: 'Симптоми 3 із 10',
        }),
      ],
      entryText,
    );

    const stress = result.find((item) => item.candidate_key === 'stress_level');
    expect(stress?.evidence_text.toLowerCase()).toContain('тривож');
    expect(stress?.value_number).toBe(2);
  });

  it('dedupes duplicate evening_discomfort — keeps explicit 7/10 over inferred worsening', () => {
    const entryText =
      'День 23 (2026-03-23): Сьогодні був сильний дискомфорт на 7 із 10. Симптоми посилилися ближче до вечора.';
    const result = normalizeExtractionCandidates(
      [
        baseCandidate({
          candidate_key: 'evening_discomfort',
          scale_min: 0,
          scale_max: 10,
          value_number: 7,
          evidence_text: 'сильний дискомфорт на 7 із 10',
          confidence: 0.92,
        }),
        baseCandidate({
          candidate_key: 'evening_discomfort',
          scale_min: 0,
          scale_max: 10,
          value_number: 8,
          evidence_text: 'Симптоми посилилися',
          confidence: 0.75,
        }),
      ],
      entryText,
    );

    const discomfort = result.filter((item) => item.candidate_key === 'evening_discomfort');
    expect(discomfort).toHaveLength(1);
    expect(discomfort[0]?.value_number).toBe(7);
  });
});
