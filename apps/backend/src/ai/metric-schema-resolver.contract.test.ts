import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadMetricSchemaResolverPrompt } from './prompt-loader.js';
import { schemaResolverOutputSchema } from '../modules/metrics/metric-schema-resolver.schemas.js';

const FIXTURES_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  'prompts',
  '__fixtures__',
  'metric-schema-resolver',
);

describe('metric-schema-resolver prompt contract', () => {
  it('loads prompt version from frontmatter', () => {
    const prompt = loadMetricSchemaResolverPrompt();
    expect(prompt.version).toBe('1.0.0');
    expect(prompt.body).toContain('## Purpose');
  });

  it('validates fixture resolver output', () => {
    const raw = readFileSync(join(FIXTURES_DIR, 'output-en-01.json'), 'utf8');
    const parsed = schemaResolverOutputSchema.parse(JSON.parse(raw));
    expect(parsed.decisions).toHaveLength(2);
    expect(parsed.decisions[0]?.action).toBe('link_existing');
  });
});
