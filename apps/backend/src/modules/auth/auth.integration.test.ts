import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getInternalApiKey, resetConfigCache } from '@metrixify/config';
import { buildApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { SESSION_COOKIE_NAME } from './auth.constants.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const telegramUserId = 9_003_001;

describe.skipIf(!hasDatabase)('auth API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const internalKey = process.env.SESSION_SECRET ?? 'test-secret-key-32chars-minimum!!';

  beforeAll(async () => {
    process.env.SESSION_SECRET = internalKey;
    process.env.FRONTEND_URL = 'http://localhost:5173';
    resetConfigCache();
    const ok = await prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false);
    if (!ok) {
      throw new Error('Database is not reachable');
    }
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await prisma.loginToken.deleteMany({
      where: { user: { telegramAccounts: { some: { telegramUserId: BigInt(telegramUserId) } } } },
    });
    await prisma.session.deleteMany({
      where: { user: { telegramAccounts: { some: { telegramUserId: BigInt(telegramUserId) } } } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  async function createLoginToken(): Promise<string> {
    const linkRes = await app.inject({
      method: 'POST',
      url: '/api/internal/telegram/login-link',
      headers: { 'x-metrixify-internal-key': getInternalApiKey() },
      payload: { telegramUserId },
    });
    expect(linkRes.statusCode).toBe(200);
    const { loginUrl } = linkRes.json() as { loginUrl: string };
    const token = new URL(loginUrl).searchParams.get('token');
    if (!token) {
      throw new Error('Missing token in login URL');
    }
    return token;
  }

  function sessionCookie(
    response: Awaited<ReturnType<typeof app.inject>>,
  ): Record<string, string> {
    const setCookie = response.headers['set-cookie'];
    const header = Array.isArray(setCookie) ? setCookie.join(';') : setCookie;
    const match = header?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    if (!match?.[1]) {
      throw new Error('Session cookie not set');
    }
    return { [SESSION_COOKIE_NAME]: match[1] };
  }

  it('rejects unauthenticated entries list', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/entries' });
    expect(response.statusCode).toBe(401);
  });

  it('exchanges login token for session and returns me', async () => {
    const token = await createLoginToken();

    const exchange = await app.inject({
      method: 'POST',
      url: '/api/auth/telegram-token',
      payload: { token },
    });
    expect(exchange.statusCode).toBe(200);
    const cookies = sessionCookie(exchange);

    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies,
    });
    expect(me.statusCode).toBe(200);
    const body = me.json() as { user: { id: string } };
    expect(body.user.id).toBeTruthy();

    const entries = await app.inject({
      method: 'GET',
      url: '/api/entries?limit=5',
      cookies,
    });
    expect(entries.statusCode).toBe(200);
  });

  it('rejects reused login token', async () => {
    const token = await createLoginToken();

    const first = await app.inject({
      method: 'POST',
      url: '/api/auth/telegram-token',
      payload: { token },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: '/api/auth/telegram-token',
      payload: { token },
    });
    expect(second.statusCode).toBe(401);
  });

  it('logout succeeds with empty JSON body (browser fetch quirk)', async () => {
    const token = await createLoginToken();
    const exchange = await app.inject({
      method: 'POST',
      url: '/api/auth/telegram-token',
      payload: { token },
    });
    const cookies = sessionCookie(exchange);

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { 'content-type': 'application/json' },
      payload: '',
      cookies,
    });
    expect(logout.statusCode).toBe(200);
  });

  it('logs out and clears session', async () => {
    const token = await createLoginToken();
    const exchange = await app.inject({
      method: 'POST',
      url: '/api/auth/telegram-token',
      payload: { token },
    });
    const cookies = sessionCookie(exchange);

    const logout = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies,
    });
    expect(logout.statusCode).toBe(200);

    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies,
    });
    expect(me.statusCode).toBe(401);
  });
});
