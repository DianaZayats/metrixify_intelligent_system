import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { findEnvFilePath } from './env-path.js';

loadDotenv({ path: findEnvFilePath() });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_VERSION: z.string().default('0.1.0'),
    BACKEND_PORT: z.coerce.number().default(3000),
    FRONTEND_PORT: z.coerce.number().default(5173),
    FRONTEND_URL: z.string().url().optional(),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().default('redis://localhost:6379'),
    SESSION_SECRET: z.string().min(32).optional(),
    BACKEND_URL: z.string().url().default('http://localhost:3000'),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    INTERNAL_API_KEY: z.string().min(16).optional(),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_TRANSCRIPTION_MODEL: z.string().default('whisper-1'),
    OPENAI_SUMMARY_MODEL: z.string().default('gpt-4o-mini'),
    OPENAI_EXTRACTION_MODEL: z.string().default('gpt-4o-mini'),
    OPENAI_SCHEMA_RESOLVER_MODEL: z.string().default('gpt-4o'),
    OPENAI_FACT_EXTRACTION_MODEL: z.string().default('gpt-4o-mini'),
    OPENAI_INSIGHTS_MODEL: z.string().default('gpt-4o-mini'),
    METRIC_SCHEMA_LLM_APPLY_MIN: z.coerce.number().min(0).max(1).default(0.8),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production' && !data.SESSION_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'SESSION_SECRET is required in production (min 32 characters)',
        path: ['SESSION_SECRET'],
      });
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

let cachedConfig: AppConfig | null = null;

export function loadConfig(overrides: Partial<Record<string, string>> = {}): AppConfig {
  const parsed = envSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

/**
 * Secret used to sign session cookies and hash login tokens (stage 3+).
 * Not the same as a user's one-time Telegram login token.
 */
export function getSessionSecret(): string {
  const config = getConfig();
  if (config.SESSION_SECRET) {
    return config.SESSION_SECRET;
  }
  if (config.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is required in production');
  }
  throw new Error(
    'SESSION_SECRET is missing. Run `npm run env:setup` or `npm run app:dev` to generate one for local development.',
  );
}

export function resetConfigCache(): void {
  cachedConfig = null;
}

/** Shared secret for bot → backend internal routes. Falls back to SESSION_SECRET in dev. */
export function getInternalApiKey(): string {
  const config = getConfig();
  if (config.INTERNAL_API_KEY) {
    return config.INTERNAL_API_KEY;
  }
  return getSessionSecret();
}

/** Public web app origin for Telegram login links. */
export function getFrontendUrl(): string {
  const config = getConfig();
  if (config.FRONTEND_URL) {
    return config.FRONTEND_URL.replace(/\/$/, '');
  }
  return `http://localhost:${config.FRONTEND_PORT}`;
}

/**
 * Backend origin for server-to-server calls (e.g. bot → backend).
 * Normalizes `localhost` → `127.0.0.1` to avoid Windows ECONNREFUSED on ::1.
 */
export function getBackendUrl(): string {
  const config = getConfig();
  try {
    const url = new URL(config.BACKEND_URL);
    if (url.hostname === 'localhost') {
      url.hostname = '127.0.0.1';
    }
    return url.origin;
  } catch {
    return `http://127.0.0.1:${config.BACKEND_PORT}`;
  }
}

export function getOpenAiApiKey(): string {
  const config = getConfig();
  if (!config.OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY is missing. Add it to .env for voice transcription (stage 4+).',
    );
  }
  return config.OPENAI_API_KEY;
}

export function getTelegramBotToken(): string {
  const config = getConfig();
  if (!config.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is missing. Required for downloading voice files.');
  }
  return config.TELEGRAM_BOT_TOKEN;
}
