#!/usr/bin/env tsx
/**
 * Set entryDate from inline (YYYY-MM-DD) in diary text and realign metric observedAt.
 * Usage: npx tsx scripts/qa/backfill-entry-dates-from-text.ts [telegramUserId]
 */
import { backfillEntryDatesForUser } from '../../apps/backend/src/modules/entries/entry.service.js';
import { prisma } from '../../apps/backend/src/shared/db/prisma.js';

async function resolveUserId(telegramArg?: string): Promise<string> {
  if (telegramArg) {
    const user = await prisma.user.findFirst({
      where: { telegramAccounts: { some: { telegramUserId: BigInt(telegramArg) } } },
    });
    if (!user) {
      throw new Error(`User not found for telegram id ${telegramArg}`);
    }
    return user.id;
  }

  const top = await prisma.diaryEntry.groupBy({
    by: ['userId'],
    where: { rawText: { contains: 'День' } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 1,
  });
  const userId = top[0]?.userId;
  if (!userId) {
    throw new Error('No diary entries with «День» header found');
  }
  return userId;
}

async function main() {
  const userId = await resolveUserId(process.argv[2]);
  const result = await backfillEntryDatesForUser(userId);

  const sample = await prisma.diaryEntry.findMany({
    where: { userId, rawText: { contains: 'День' } },
    orderBy: { entryDate: 'asc' },
    take: 5,
    select: { entryDate: true, rawText: true },
  });

  console.log(JSON.stringify({ userId, ...result, sample: sample.map((e) => ({
    entryDate: e.entryDate.toISOString().slice(0, 10),
    header: e.rawText?.match(/\((\d{4}-\d{2}-\d{2})\)/)?.[1],
  })) }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
