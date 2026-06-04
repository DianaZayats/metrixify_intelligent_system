#!/usr/bin/env tsx
import { loadPersonaEnv, requireOpenAiKey } from './persona/lib/env.js';
import { reprocessEntryMetricsForUser } from '../apps/backend/src/modules/entries/entry.service.js';
import { prisma } from '../apps/backend/src/shared/db/prisma.js';

loadPersonaEnv();
requireOpenAiKey();

const textContains = process.argv[2] ?? 'понеділок';
const telegramUserId = BigInt(process.argv[3] ?? '589963796');

async function main(): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { telegramAccounts: { some: { telegramUserId } } },
  });
  if (!user) {
    console.error('User not found');
    process.exit(1);
  }

  const entry = await prisma.diaryEntry.findFirst({
    where: { userId: user.id, rawText: { contains: textContains } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, entryDate: true, rawText: true },
  });
  if (!entry) {
    console.error('Entry not found for text:', textContains);
    process.exit(1);
  }

  console.log(`Reprocessing entry ${entry.id} (${entry.entryDate.toISOString().slice(0, 10)})`);
  const result = await reprocessEntryMetricsForUser(entry.id, user.id, user.timezone);
  console.log(`Done — status ${result.processingStatus}`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
