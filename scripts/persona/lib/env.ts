import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function findEnvFilePath(): string {
  let dir = resolve(import.meta.dirname, '../../..');
  while (true) {
    const envPath = resolve(dir, '.env');
    if (existsSync(envPath)) {
      return envPath;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return resolve(process.cwd(), '.env');
}

export function loadPersonaEnv(): void {
  loadDotenv({ path: findEnvFilePath() });
}

export function requireOpenAiKey(): void {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error('OPENAI_API_KEY is required for persona:analyze (full AI pipeline)');
  }
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL is required for persona:analyze');
  }
}
