/**
 * Ensures `.env` exists and contains a strong SESSION_SECRET for local development.
 * Run automatically via `npm run app:dev` and `npm run env:setup`.
 */
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const envPath = resolve(root, '.env');
const examplePath = resolve(root, '.env.example');

const PLACEHOLDER_PATTERNS = [
  /^change-me/i,
  /^replace-me/i,
  /^your[-_]?secret/i,
  /^1234567890+$/,
];

function parseEnv(content: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map.set(key, value);
  }
  return map;
}

function isWeakOrMissingSessionSecret(value: string | undefined): boolean {
  if (!value?.trim()) {
    return true;
  }
  if (value.length < 32) {
    return true;
  }
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

function upsertEnvVar(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');

  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }

  const trimmed = content.replace(/\s*$/, '');
  const separator = trimmed.length === 0 ? '' : '\n';
  return `${trimmed}${separator}${line}\n`;
}

function main(): void {
  if (process.env.NODE_ENV === 'production') {
    console.log('[ensure-env] Skipping auto SESSION_SECRET in production');
    return;
  }

  if (!existsSync(envPath)) {
    if (!existsSync(examplePath)) {
      throw new Error('Missing .env.example — cannot bootstrap .env');
    }
    copyFileSync(examplePath, envPath);
    console.log('[ensure-env] Created .env from .env.example');
  }

  let content = readFileSync(envPath, 'utf8');
  const parsed = parseEnv(content);
  const currentSecret = parsed.get('SESSION_SECRET');

  if (isWeakOrMissingSessionSecret(currentSecret)) {
    const secret = randomBytes(32).toString('hex');
    content = upsertEnvVar(content, 'SESSION_SECRET', secret);
    writeFileSync(envPath, content, 'utf8');
    console.log('[ensure-env] Generated SESSION_SECRET in .env (local dev only)');
  } else {
    console.log('[ensure-env] SESSION_SECRET already set');
  }
}

main();
