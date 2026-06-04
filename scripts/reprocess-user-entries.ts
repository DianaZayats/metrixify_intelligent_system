#!/usr/bin/env tsx
import { loadPersonaEnv, requireOpenAiKey } from './persona/lib/env.js';
import { loadPersonaSpec } from './persona/lib/load.js';
import { recalculateAnalyticsForUser } from '../apps/backend/src/modules/analytics/analytics.service.js';
import { reprocessEntryMetricsForUser } from '../apps/backend/src/modules/entries/entry.service.js';
import { prisma } from '../apps/backend/src/shared/db/prisma.js';

const telegramUserId = BigInt(process.argv[2] ?? '589963796');

async function main(): Promise<void> {
  loadPersonaEnv();
  requireOpenAiKey();

  const user = await prisma.user.findFirst({
    where: { telegramAccounts: { some: { telegramUserId } } },
  });
  if (!user) {
    console.error('User not found for telegram id', telegramUserId.toString());
    process.exit(1);
  }

  const entries = await prisma.diaryEntry.findMany({
    where: { userId: user.id },
    orderBy: { entryDate: 'asc' },
    select: { id: true, entryDate: true, processingStatus: true },
  });

  console.log(`[reprocess] user ${user.id} — ${entries.length} entries`);

  const spec = loadPersonaSpec('peanut-rash-quick');
  for (const metric of spec.metrics) {
    await prisma.metricDefinition.updateMany({
      where: { userId: user.id, key: metric.key },
      data: {
        aliasesJson: [metric.title, ...(metric.title_i18n?.uk ? [metric.title_i18n.uk] : [])],
      },
    });
  }
  console.log('[reprocess] reset peanut-rash-quick metric aliases');

  let completed = 0;
  let failed = 0;

  for (const [index, entry] of entries.entries()) {
    const date = entry.entryDate.toISOString().slice(0, 10);
    console.log(`[reprocess] ${index + 1}/${entries.length} — ${date} (${entry.processingStatus})`);
    try {
      const result = await reprocessEntryMetricsForUser(entry.id, user.id, user.timezone);
      if (result.processingStatus === 'completed') {
        completed += 1;
      } else {
        failed += 1;
        console.error(`[reprocess] ${date} ended with status ${result.processingStatus}`);
      }
    } catch (error) {
      failed += 1;
      console.error(`[reprocess] ${date} failed:`, error);
    }
  }

  const recalc = await recalculateAnalyticsForUser(user.id);
  console.log(
    `[reprocess] recalculated ${recalc.correlationCount} pairs (official ${recalc.officialCount}, exploratory ${recalc.exploratoryCount})`,
  );
  console.log(`[reprocess] done — completed ${completed}, failed ${failed}`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('[reprocess] fatal:', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
