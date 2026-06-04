import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';

describe('system routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ?? 'postgresql://metrixify:metrixify@localhost:5432/metrixify';
    process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? 'test-secret-key-32chars-min!!';
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/system/version returns app metadata', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/system/version' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.name).toBe('metrixify');
    expect(body.version).toBeTruthy();
  });
});
