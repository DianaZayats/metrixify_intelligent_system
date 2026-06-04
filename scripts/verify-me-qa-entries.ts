#!/usr/bin/env tsx
import { loadPersonaEnv } from './persona/lib/env.js';
import { prisma } from '../apps/backend/src/shared/db/prisma.js';

loadPersonaEnv();

const telegramUserId = BigInt(process.argv[2] ?? '589963796');

async function main(): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { telegramAccounts: { some: { telegramUserId } } },
  });
  if (!user) {
    console.log('User not found');
    return;
  }

  const entries = await prisma.diaryEntry.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      entryDate: true,
      createdAt: true,
      processingStatus: true,
      processingError: true,
      rawText: true,
    },
  });

  console.log(`User ${user.id} | timezone ${user.timezone}\n`);
  console.log('Recent entries:');
  for (const e of entries) {
    console.log(
      `  ${e.createdAt.toISOString()} | entryDate ${e.entryDate.toISOString().slice(0, 10)} | ${e.processingStatus}`,
    );
    console.log(`    ${(e.rawText ?? '').replace(/\s+/g, ' ').slice(0, 120)}...`);
    if (e.processingError) {
      console.log(`    ERROR: ${e.processingError.slice(0, 200)}`);
    }
  }

  const recapEntries = entries.filter((e) =>
    /підсумок|period recap/i.test(e.rawText ?? ''),
  );

  for (const entry of recapEntries.slice(0, 2)) {
    const obs = await prisma.metricObservation.findMany({
      where: { entryId: entry.id },
      include: { metricDefinition: { select: { key: true } } },
      orderBy: [{ observedAt: 'asc' }, { createdAt: 'asc' }],
    });

    console.log(`\n--- Entry ${entry.entryDate.toISOString().slice(0, 10)} (${entry.processingStatus}) ---`);
    console.log(`Text: ${(entry.rawText ?? '').replace(/\s+/g, ' ').slice(0, 160)}`);
    console.log(`Observations: ${obs.length}`);

    const byDate = new Map<string, Record<string, boolean>>();
    for (const o of obs) {
      const date = o.observedAt.toISOString().slice(0, 10);
      const bucket = byDate.get(date) ?? {};
      bucket[o.metricDefinition.key] = o.valueBoolean ?? false;
      byDate.set(date, bucket);
    }

    for (const [date, metrics] of [...byDate.entries()].sort()) {
      console.log(
        `  ${date} | nuts=${metrics.nuts_consumed ?? '—'} | rash=${metrics.skin_rash_occurred ?? '—'}`,
      );
    }

    const distinctDates = byDate.size;
    console.log(`Distinct calendar days: ${distinctDates}`);
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
