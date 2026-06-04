import { describe, expect, it } from 'vitest';
import {
  generatePersonaDiaryDays,
  generatePersonaDiaryOutput,
  seedFromPersonaId,
} from './generator.js';
import type { PersonaSpec } from './spec.js';

const baseSpec: PersonaSpec = {
  id: 'test-persona',
  locale: 'uk',
  timezone: 'Europe/Kyiv',
  start_date: '2026-01-01',
  calendar_days: 45,
  event_density: 0.7,
  diary_format: 'daily',
  recap_count: 5,
  metrics: [
    { key: 'nuts_consumed', title: 'Nuts', value_type: 'boolean' },
    { key: 'skin_rash_occurred', title: 'Rash', value_type: 'boolean' },
  ],
  latent_patterns: [
    {
      type: 'boolean_cooccurrence',
      metric_a: 'nuts_consumed',
      metric_b: 'skin_rash_occurred',
      lag_days: 0,
      base_rate_a: 0.55,
      cooccurrence_rate: 0.88,
      base_rate_b: 0.12,
    },
  ],
};

describe('generatePersonaDiaryOutput', () => {
  it('daily format produces one file per manifest day', () => {
    const output = generatePersonaDiaryOutput(baseSpec);
    expect(output.manifestDays.length).toBeGreaterThan(14);
    expect(output.files.length).toBe(output.manifestDays.length);
    for (const file of output.files) {
      expect(file.entryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(file.text.length).toBeGreaterThan(10);
    }
  });

  it('weekly_recap produces recap_count files with same manifest volume', () => {
    const daily = generatePersonaDiaryDays(baseSpec);
    const weekly = generatePersonaDiaryOutput({
      ...baseSpec,
      id: 'test-weekly',
      diary_format: 'weekly_recap',
      recap_count: 5,
      generation_seed_from: 'test-persona',
    });

    expect(weekly.files.length).toBe(5);
    expect(weekly.manifestDays.length).toBe(daily.length);
    expect(weekly.manifestDays.map((d) => d.date)).toEqual(daily.map((d) => d.date));
    for (const file of weekly.files) {
      expect(file.text).toMatch(/Підсумок періоду|Period recap/);
      expect(file.text).toMatch(/\d{1,2} /);
    }
  });

  it('generation_seed_from aligns manifest with reference persona id', () => {
    const refDays = generatePersonaDiaryDays({ ...baseSpec, id: 'peanut-rash' });
    const quickDays = generatePersonaDiaryDays({
      ...baseSpec,
      id: 'peanut-rash-quick',
      generation_seed_from: 'peanut-rash',
    });
    expect(quickDays.map((d) => d.signals)).toEqual(refDays.map((d) => d.signals));
    expect(quickDays.map((d) => d.date)).toEqual(refDays.map((d) => d.date));
  });
});

describe('seedFromPersonaId', () => {
  it('is deterministic', () => {
    expect(seedFromPersonaId('peanut-rash')).toBe(seedFromPersonaId('peanut-rash'));
  });
});
