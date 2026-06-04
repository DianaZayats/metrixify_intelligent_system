import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { jsonContextPackToToon } from '@metrixify/llm-payload-codec';
import { loadProfileFactExtractionPrompt } from './prompt-loader.js';
import { profileFactExtractionOutputSchema } from '../modules/profile-facts/profile-fact.schemas.js';

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  'prompts',
  '__fixtures__',
  'profile-fact-extraction',
);

describe('profile-fact-extraction prompt contract', () => {
  it('loads prompt version from frontmatter', () => {
    const prompt = loadProfileFactExtractionPrompt();
    expect(prompt.version).toBe('1.1.0');
    expect(prompt.body).toContain('## Purpose');
  });

  it('validates fixture output', () => {
    const raw = readFileSync(join(FIXTURES_DIR, 'output-uk-01.json'), 'utf8');
    const parsed = profileFactExtractionOutputSchema.parse(JSON.parse(raw));
    expect(parsed.facts).toHaveLength(3);
    expect(parsed.facts[0]?.key).toBe('job_title');
  });

  it('encodes sample context pack to TOON', () => {
    const toon = jsonContextPackToToon({
      schema_version: '1',
      entry: {
        id: 'entry-1',
        entry_date: '2026-05-19',
        recorded_at: '2026-05-19T22:00:00.000Z',
        source_type: 'text',
        text: 'Працюю розробником.',
        summary: 'Works as a developer.',
      },
      user: { timezone: 'UTC' },
      existing_profile_facts: [],
    });
    expect(toon).toContain('entry-1');
  });
});
