import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { jsonContextPackToToon } from '@metrixify/llm-payload-codec';
import { loadEntrySummaryPrompt } from './prompt-loader.js';
import {
  entrySummaryContextSchema,
  entrySummaryOutputSchema,
} from '../modules/summary/summary.schemas.js';

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  'prompts',
  '__fixtures__',
  'entry-summary',
);

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8'));
}

describe('entry-summary prompt contract', () => {
  it('loads prompt version from frontmatter', () => {
    const prompt = loadEntrySummaryPrompt();
    expect(prompt.version).toBe('1.1.0');
    expect(prompt.body).toContain('## Purpose');
  });

  it('validates fixture outputs against output schema', () => {
    for (const file of ['output-en-01.json', 'output-uk-01.json']) {
      const parsed = entrySummaryOutputSchema.parse(readFixture(file));
      expect(parsed.summary.length).toBeGreaterThan(0);
    }
  });

  it('validates context fixture and encodes to TOON', () => {
    const context = entrySummaryContextSchema.parse(readFixture('context-en-01.json'));
    const toon = jsonContextPackToToon(context);
    expect(toon).toContain('entry-fixture-1');
    expect(toon.length).toBeGreaterThan(0);
  });
});
