import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../shared/db/prisma.js';
import { upsertUserFromTelegram } from '../users/user.repository.js';
import {
  archiveMetricDefinitionForUser,
  ensureMetricDefinitionForCandidate,
  findMetricDefinitionByKey,
  findMetricDefinitionByKeyAnyStatus,
  resolveMetricKey,
} from './metric.repository.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const telegramUserId = 9_003_036;

describe.skipIf(!hasDatabase)('ensureMetricDefinitionForCandidate', () => {
  let userId: string;
  let entryId: string;
  const metricKey = 'evening_discomfort_bl036';

  beforeAll(async () => {
    const user = await upsertUserFromTelegram({
      telegramUserId: BigInt(telegramUserId),
    });
    userId = user.id;

    const entry = await prisma.diaryEntry.create({
      data: {
        userId,
        sourceType: 'manual',
        rawText: 'BL-036 archived metric reactivate test',
        entryDate: new Date('2026-03-20T00:00:00.000Z'),
        processingStatus: 'completed',
      },
    });
    entryId = entry.id;
  });

  afterAll(async () => {
    if (entryId) {
      await prisma.metricObservation.deleteMany({ where: { entryId } });
      await prisma.diaryEntry.delete({ where: { id: entryId } }).catch(() => undefined);
    }
    if (userId) {
      await prisma.metricDefinition.deleteMany({ where: { userId, key: metricKey } });
    }
    await prisma.$disconnect();
  });

  it('reactivates archived definition instead of creating duplicate key', async () => {
    const candidate = {
      candidate_key: metricKey,
      title: 'Evening discomfort',
      value_type: 'ordinal' as const,
      value_number: 6,
      value_text: null,
      value_boolean: null,
      unit: null,
      scale_min: 0,
      scale_max: 10,
      evidence_text: 'симптоми 6 із 10',
      confidence: 0.9,
      reasoning: null,
      observed_date: null,
      tags: ['symptoms'],
    };
    const key = resolveMetricKey(candidate);

    const created = await ensureMetricDefinitionForCandidate({
      userId,
      entryId,
      candidate,
      key,
    });
    expect(created.status).toBe('active');

    await archiveMetricDefinitionForUser(created.id, userId);

    expect(await findMetricDefinitionByKey(userId, key)).toBeNull();
    expect((await findMetricDefinitionByKeyAnyStatus(userId, key))?.status).toBe('archived');

    const reactivated = await ensureMetricDefinitionForCandidate({
      userId,
      entryId,
      candidate: { ...candidate, value_number: 7, evidence_text: 'симптоми 7 із 10' },
      key,
    });

    expect(reactivated.id).toBe(created.id);
    expect(reactivated.status).toBe('active');

    const count = await prisma.metricDefinition.count({
      where: { userId, key },
    });
    expect(count).toBe(1);
  });
});
