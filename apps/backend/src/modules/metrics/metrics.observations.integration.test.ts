import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getInternalApiKey, resetConfigCache } from '@metrixify/config';
import { buildApp } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { SESSION_COOKIE_NAME } from '../auth/auth.constants.js';
import { upsertUserFromTelegram } from '../users/user.repository.js';
import {
  createMetricDefinitionFromCandidate,
  createMetricObservation,
  resolveMetricKey,
} from './metric.repository.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const telegramUserId = 9_003_011;

describe.skipIf(!hasDatabase)('observation PATCH/DELETE API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let observationId: string;
  let entryId: string;
  let userId: string;
  const internalKey = process.env.SESSION_SECRET ?? 'test-secret-key-32chars-minimum!!';

  beforeAll(async () => {
    process.env.SESSION_SECRET = internalKey;
    resetConfigCache();
    app = await buildApp();
    await app.ready();

    const user = await upsertUserFromTelegram({
      telegramUserId: BigInt(telegramUserId),
    });
    userId = user.id;

    const entry = await prisma.diaryEntry.create({
      data: {
        userId,
        sourceType: 'manual',
        rawText: 'Observation audit integration test',
        entryDate: new Date('2026-05-19T00:00:00.000Z'),
        processingStatus: 'completed',
      },
    });
    entryId = entry.id;

    const candidate = {
      candidate_key: 'wellbeing',
      title: 'Wellbeing',
      value_type: 'ordinal' as const,
      value_number: 3,
      value_text: null,
      value_boolean: null,
      unit: null,
      scale_min: 1,
      scale_max: 5,
      evidence_text: 'felt okay',
      confidence: 0.9,
      reasoning: null,
      observed_date: null,
      tags: ['mood'],
    };

    const definition = await createMetricDefinitionFromCandidate({
      userId,
      entryId,
      key: resolveMetricKey(candidate),
      candidate,
    });

    const observation = await createMetricObservation({
      userId,
      entryId,
      metricDefinitionId: definition.id,
      observedAt: new Date('2026-05-19T12:00:00.000Z'),
      valueNumber: 3,
      valueText: null,
      valueBoolean: null,
      confidence: 0.9,
      evidenceText: 'felt okay',
      metadataJson: {
        observedAtPrecision: 'date_only',
        narrativeOrder: 1,
      },
    });
    observationId = observation.id;
  });

  afterAll(async () => {
    if (entryId) {
      await prisma.metricObservation.deleteMany({ where: { entryId } });
      await prisma.metricDefinition.deleteMany({ where: { createdFromEntryId: entryId } });
      await prisma.diaryEntry.delete({ where: { id: entryId } }).catch(() => undefined);
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

  it('patches observation value and stores audit metadata', async () => {
    const cookies = await authCookies();
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/observations/${observationId}`,
      cookies,
      payload: {
        valueNumber: 4,
        evidenceText: 'corrected manually',
        editedVia: 'api',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { valueNumber: number; evidenceText: string };
    expect(body.valueNumber).toBe(4);
    expect(body.evidenceText).toBe('corrected manually');

    const stored = await prisma.metricObservation.findUnique({ where: { id: observationId } });
    expect(stored?.source).toBe('manual');
    const metadata = stored?.metadataJson as {
      audit?: { source: string; editedVia: string; lastEdit?: { previous: { valueNumber: number } } };
    };
    expect(metadata.audit?.source).toBe('manual');
    expect(metadata.audit?.editedVia).toBe('api');
    expect(metadata.audit?.lastEdit?.previous.valueNumber).toBe(3);
  });

  it('deletes observation and appends entry correction audit', async () => {
    const cookies = await authCookies();
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/observations/${observationId}`,
      cookies,
      payload: { editedVia: 'api' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { deleted: boolean; audit: { action: string } };
    expect(body.deleted).toBe(true);
    expect(body.audit.action).toBe('delete');

    const stored = await prisma.metricObservation.findUnique({ where: { id: observationId } });
    expect(stored).toBeNull();

    const entry = await prisma.diaryEntry.findUnique({ where: { id: entryId } });
    const metadata = entry?.metadataJson as {
      correctionAudit?: Array<{ action: string; observationId: string }>;
    };
    expect(metadata.correctionAudit?.length).toBeGreaterThan(0);
    expect(metadata.correctionAudit?.[0]?.action).toBe('delete');
    expect(metadata.correctionAudit?.[0]?.observationId).toBe(observationId);
  });
});
