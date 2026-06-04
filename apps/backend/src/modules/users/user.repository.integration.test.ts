import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../../shared/db/prisma.js';
import { createUser, findUserById } from './user.repository.js';
import { createDiaryEntry } from '../entries/entry.repository.js';

async function isDatabaseReachable(): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    return false;
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await isDatabaseReachable();

describe.skipIf(!dbReachable)('user and entry repositories', () => {
  let userId: string;

  afterAll(async () => {
    if (userId) {
      await prisma.diaryEntry.deleteMany({ where: { userId } });
      await prisma.telegramAccount.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it('creates a user and diary entry', async () => {
    const user = await createUser({ timezone: 'UTC' });
    userId = user.id;

    const entry = await createDiaryEntry({
      user: { connect: { id: user.id } },
      sourceType: 'text',
      rawText: 'Woke up late and felt off today.',
      entryDate: new Date(),
      processingStatus: 'received',
    });

    expect(entry.userId).toBe(user.id);

    const loaded = await findUserById(user.id);
    expect(loaded?.timezone).toBe('UTC');
  });
});
