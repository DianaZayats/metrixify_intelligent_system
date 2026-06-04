import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getInternalApiKey, resetConfigCache } from '@metrixify/config';
import { buildApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { SESSION_COOKIE_NAME } from '../auth/auth.constants.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const telegramUserId = 9_003_010;

describe.skipIf(!hasDatabase)('metrics API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const internalKey = process.env.SESSION_SECRET ?? 'test-secret-key-32chars-minimum!!';

  beforeAll(async () => {
    process.env.SESSION_SECRET = internalKey;
    resetConfigCache();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function authCookies(): Promise<Record<string, string>> {
    const linkRes = await app.inject({
      method: 'POST',
      url: '/api/internal/telegram/login-link',
      headers: { 'x-metrixify-internal-key': getInternalApiKey() },
      payload: { telegramUserId },
    });
    const { loginUrl } = linkRes.json() as { loginUrl: string };
    const token = new URL(loginUrl).searchParams.get('token');
    const auth = await app.inject({
      method: 'POST',
      url: '/api/auth/telegram-token',
      payload: { token },
    });
    const setCookie = auth.headers['set-cookie'];
    const header = Array.isArray(setCookie) ? setCookie.join(';') : setCookie;
    const match = header?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    if (!match?.[1]) {
      throw new Error('Session cookie not set');
    }
    return { [SESSION_COOKIE_NAME]: match[1] };
  }

  it('lists metrics for authenticated user', async () => {
    const cookies = await authCookies();
    const response = await app.inject({
      method: 'GET',
      url: '/api/metrics',
      cookies,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: unknown[] };
    expect(Array.isArray(body.items)).toBe(true);
  });

  it('lists observations for authenticated user', async () => {
    const cookies = await authCookies();
    const response = await app.inject({
      method: 'GET',
      url: '/api/metrics/observations',
      cookies,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: Array<{ observedAt: string; valueDisplay: string }> };
    expect(Array.isArray(body.items)).toBe(true);
  });
});
