import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getInternalApiKey, resetConfigCache } from '@metrixify/config';
import { buildApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { SESSION_COOKIE_NAME } from '../auth/auth.constants.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const telegramUserId = 9_003_020;

describe.skipIf(!hasDatabase)('user delete-data API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let userId: string;
  const internalKey = process.env.SESSION_SECRET ?? 'test-secret-key-32chars-minimum!!';

  beforeAll(async () => {
    process.env.SESSION_SECRET = internalKey;
    resetConfigCache();
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    if (userId) {
      await prisma.correlationResult.deleteMany({ where: { userId } });
      await prisma.metricObservation.deleteMany({ where: { userId } });
      await prisma.metricDefinition.deleteMany({ where: { userId } });
      await prisma.diaryEntry.deleteMany({ where: { userId } });
      await prisma.session.deleteMany({ where: { userId } });
      await prisma.telegramAccount.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
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

  it('exports user data as JSON attachment', async () => {
    const cookies = await authCookies();
    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies,
    });
    userId = (me.json() as { user: { id: string } }).user.id;

    await prisma.diaryEntry.create({
      data: {
        userId,
        sourceType: 'manual',
        rawText: 'Export test entry',
        entryDate: new Date('2026-05-20T00:00:00.000Z'),
        processingStatus: 'completed',
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/user/export',
      cookies,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-disposition']).toMatch(/attachment; filename="metrixify-export-/);
    const body = response.json() as { formatVersion: number; entries: unknown[]; user: { id: string } };
    expect(body.formatVersion).toBe(1);
    expect(body.user.id).toBe(userId);
    expect(body.entries.length).toBeGreaterThan(0);
  });

  it('exports user data as Excel attachment', async () => {
    const cookies = await authCookies();
    const response = await app.inject({
      method: 'GET',
      url: '/api/user/export?format=xlsx',
      cookies,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(response.headers['content-disposition']).toMatch(/\.xlsx"/);
    expect(response.rawPayload.subarray(0, 2).toString('utf8')).toBe('PK');
  });

  it('requires confirmation phrase and deletes all user data while keeping session', async () => {
    const cookies = await authCookies();
    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies,
    });
    userId = (me.json() as { user: { id: string } }).user.id;

    const entry = await prisma.diaryEntry.create({
      data: {
        userId,
        sourceType: 'manual',
        rawText: 'Delete data test',
        entryDate: new Date('2026-05-19T00:00:00.000Z'),
        processingStatus: 'completed',
      },
    });

    const invalid = await app.inject({
      method: 'POST',
      url: '/api/user/delete-data',
      cookies,
      payload: { confirm: 'WRONG' },
    });
    expect(invalid.statusCode).toBe(400);

    const response = await app.inject({
      method: 'POST',
      url: '/api/user/delete-data',
      cookies,
      payload: { confirm: 'DELETE' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ deleted: true });

    expect(await prisma.diaryEntry.count({ where: { userId } })).toBe(0);
    expect(await prisma.diaryEntry.findUnique({ where: { id: entry.id } })).toBeNull();

    const stillLoggedIn = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies,
    });
    expect(stillLoggedIn.statusCode).toBe(200);
  });
});
