#!/usr/bin/env tsx
import { loadPersonaEnv } from './persona/lib/env.js';
import { personaTelegramUserId } from './persona/lib/load.js';
import {
  getAnalyticsCorrelations,
  recalculateAnalyticsForUser,
} from '../apps/backend/src/modules/analytics/analytics.service.js';
import { prisma } from '../apps/backend/src/shared/db/prisma.js';

loadPersonaEnv();

async function main(): Promise<void> {
  const personaId = 'peanut-rash-quick';
  const telegramUserId = BigInt(personaTelegramUserId(personaId));
  const user = await prisma.user.findFirst({
    where: { telegramAccounts: { some: { telegramUserId } } },
  });

  if (!user) {
    console.error('Persona user not found — run persona:analyze first');
    process.exit(1);
  }

  console.log('=== AN-03 / heatmap smoke (persona user) ===');
  const recalc = await recalculateAnalyticsForUser(user.id);
  console.log(
    `Recalculate: ${recalc.correlationCount} pairs (${recalc.officialCount} official, ${recalc.exploratoryCount} exploratory)`,
  );

  const list = await getAnalyticsCorrelations(user.id, { method: 'pearson', lagDays: 0 }, 'en');
  const heatmap = list.heatmap;
  console.log(
    `Heatmap: ${heatmap.metricIds.length} metrics, ${heatmap.values.filter((v) => v != null).length} cells`,
  );
  console.log(`Table rows: ${list.items.length}`);
  const exploratory = list.items.filter((item) => item.exploratory);
  console.log(`Exploratory badges: ${exploratory.length}/${list.items.length}`);

  const emptyUser = await prisma.user.findFirst({
    where: {
      diaryEntries: { none: {} },
      metricObservations: { none: {} },
    },
    select: { id: true },
  });

  if (emptyUser) {
    console.log('\n=== AN-01 smoke (empty user) ===');
    const emptyRecalc = await recalculateAnalyticsForUser(emptyUser.id);
    console.log(`Empty recalculate: ${emptyRecalc.correlationCount} pairs (expect 0)`);
  } else {
    console.log('\n=== AN-01 smoke === skipped (no empty user in DB)');
  }

  const pass =
    recalc.correlationCount > 0 &&
    heatmap.metricIds.length >= 2 &&
    heatmap.values.length > 0 &&
    list.items.length > 0;

  console.log(`\nSMOKE: ${pass ? 'PASS' : 'FAIL'}`);
  await prisma.$disconnect();
  process.exit(pass ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
