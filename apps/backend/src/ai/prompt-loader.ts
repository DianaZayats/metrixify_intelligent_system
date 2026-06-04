import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROMPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'prompts');

export type LoadedPrompt = {
  version: string;
  body: string;
};

const FRONTMATTER_VERSION = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

function parseFrontmatterVersion(raw: string): string | null {
  const match = raw.match(/^version:\s*["']?([^"'\n]+)["']?\s*$/m);
  return match?.[1]?.trim() ?? null;
}

export function loadPromptFile(filename: string): LoadedPrompt {
  const fullPath = join(PROMPTS_DIR, filename);
  const raw = readFileSync(fullPath, 'utf8');
  const parsed = raw.match(FRONTMATTER_VERSION);

  if (!parsed) {
    throw new Error(`Prompt ${filename} is missing YAML frontmatter`);
  }

  const version = parseFrontmatterVersion(parsed[1]);
  if (!version) {
    throw new Error(`Prompt ${filename} is missing version in frontmatter`);
  }

  return {
    version,
    body: parsed[2].trim(),
  };
}

export function loadEntrySummaryPrompt(): LoadedPrompt {
  return loadPromptFile('entry-summary.prompt.md');
}

export function loadMetricExtractionPrompt(): LoadedPrompt {
  return loadPromptFile('metric-extraction.prompt.md');
}

export function loadMetricSchemaResolverPrompt(): LoadedPrompt {
  return loadPromptFile('metric-schema-resolver.prompt.md');
}

export function loadProfileFactExtractionPrompt(): LoadedPrompt {
  return loadPromptFile('profile-fact-extraction.prompt.md');
}

export function loadTelegramMessageRoutingPrompt(): LoadedPrompt {
  return loadPromptFile('telegram-message-routing.prompt.md');
}

export function loadTelegramMetricCorrectionPrompt(): LoadedPrompt {
  return loadPromptFile('telegram-metric-correction.prompt.md');
}

export function loadInsightsGenerationPrompt(): LoadedPrompt {
  return loadPromptFile('insights-generation.prompt.md');
}
