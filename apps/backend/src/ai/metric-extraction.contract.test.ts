import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { zodResponseFormat } from 'openai/helpers/zod';
import { jsonContextPackToToon } from '@metrixify/llm-payload-codec';
import { loadMetricExtractionPrompt } from './prompt-loader.js';
import {
  metricExtractionAiOutputSchema,
  metricExtractionOutputSchema,
} from '../modules/metrics/metric-extraction.schemas.js';

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  'prompts',
  '__fixtures__',
  'metric-extraction',
);

describe('metric-extraction prompt contract', () => {
  it('builds OpenAI-compatible JSON schema for structured output', () => {
    const format = zodResponseFormat(metricExtractionAiOutputSchema, 'metric_extraction');
    expect(format.type).toBe('json_schema');
    expect(format.json_schema?.name).toBe('metric_extraction');
    expect(format.json_schema?.strict).toBe(true);
    const schema = format.json_schema?.schema as {
      properties?: { metrics?: { items?: { required?: string[] } } };
    };
    const itemRequired = schema.properties?.metrics?.items?.required ?? [];
    expect(itemRequired).toContain('title_i18n');
    expect(itemRequired).toContain('tag_entries');
    expect(itemRequired).not.toContain('tags_i18n');
  });

  it('loads prompt version from frontmatter', () => {
    const prompt = loadMetricExtractionPrompt();
    expect(prompt.version).toBe('2.0.0');
    expect(prompt.body).toContain('## Purpose');
  });

  it('validates fixture output from technical task §18.5', () => {
    const raw = readFileSync(join(FIXTURES_DIR, 'output-uk-01.json'), 'utf8');
    const parsed = metricExtractionOutputSchema.parse(JSON.parse(raw));
    expect(parsed.metrics).toHaveLength(2);
    expect(parsed.metrics[0]?.candidate_key).toBe('wake_time_quality');
  });

  it('validates rich multi-event day fixture (prompt v1.4.0)', () => {
    const raw = readFileSync(join(FIXTURES_DIR, 'output-rich-day-uk-01.json'), 'utf8');
    const parsed = metricExtractionOutputSchema.parse(JSON.parse(raw));
    expect(parsed.metrics.length).toBeGreaterThanOrEqual(9);
    const keys = parsed.metrics.map((metric) => metric.candidate_key);
    expect(keys).toContain('run_duration_minutes');
    expect(keys).toContain('fast_food_breakfast');
    expect(keys).toContain('daytime_nap_occurred');
    expect(keys).toContain('personal_project_productivity');
    expect(keys).not.toContain('sleep_quality');
    expect(parsed.metrics.every((metric) => metric.value_type !== 'category')).toBe(true);
    expect(parsed.metrics.every((metric) => metric.narrative_order !== null)).toBe(true);
  });

  it('encodes sample context pack to TOON', () => {
    const toon = jsonContextPackToToon({
      schema_version: '1',
      entry: {
        id: 'entry-1',
        entry_date: '2026-05-19',
        recorded_at: '2026-05-19T22:00:00.000Z',
        source_type: 'text',
        text: 'Woke up late and felt tired.',
      },
      user: { timezone: 'UTC' },
      existing_metrics: [],
      existing_profile_facts: [],
    });
    expect(toon).toContain('entry-1');
  });
});
