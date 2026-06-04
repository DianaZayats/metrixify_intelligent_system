#!/usr/bin/env tsx
import { loadPersonaEnv } from './persona/lib/env.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { prisma } from '../apps/backend/src/shared/db/prisma.js';

loadPersonaEnv();

const telegramUserId = BigInt(process.argv[2] ?? '589963796');
const manifest = JSON.parse(
  readFileSync(
    resolve('fixtures/personas/peanut-rash-quick/diary/manifest.json'),
    'utf8',
  ),
) as {
  days: Array<{ date: string; signals: Record<string, boolean> }>;
};

const expectedByDate = new Map(
  manifest.days.map((day) => [day.date, day.signals as Record<string, boolean>]),
);

async function main(): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { telegramAccounts: { some: { telegramUserId } } },
  });
  if (!user) {
    console.log('User not found for telegram id', telegramUserId.toString());
    return;
  }

  const entries = await prisma.diaryEntry.findMany({
    where: { userId: user.id },
    orderBy: { entryDate: 'asc' },
    select: {
      id: true,
      entryDate: true,
      processingStatus: true,
      processingError: true,
      rawText: true,
    },
  });

  const defs = await prisma.metricDefinition.findMany({
    where: { userId: user.id, status: 'active' },
    orderBy: { key: 'asc' },
  });

  const observations = await prisma.metricObservation.findMany({
    where: { userId: user.id },
    include: { metricDefinition: { select: { key: true } } },
    orderBy: [{ observedAt: 'asc' }, { createdAt: 'asc' }],
  });

  console.log(`User ${user.id} | entries ${entries.length} | defs ${defs.length} | obs ${observations.length}`);
  console.log('\nEntries:');
  for (const entry of entries) {
    const date = entry.entryDate.toISOString().slice(0, 10);
    console.log(`  ${date} | ${entry.processingStatus}${entry.processingError ? ' | ' + entry.processingError : ''}`);
  }

  console.log('\nMetric definitions:');
  for (const def of defs) {
    const count = observations.filter((o) => o.metricDefinition.key === def.key).length;
    console.log(`  ${def.key} (${def.valueType}) observations=${count}`);
  }

  const extraDefs = defs.filter((d) => !['nuts_consumed', 'skin_rash_occurred'].includes(d.key));
  if (extraDefs.length > 0) {
    console.log('\nUnexpected extra metrics:');
    for (const def of extraDefs) {
      console.log(`  ${def.key}`);
    }
  }

  const byDate = new Map<string, Record<string, boolean>>();
  for (const obs of observations) {
    const date = obs.observedAt.toISOString().slice(0, 10);
    const bucket = byDate.get(date) ?? {};
    bucket[obs.metricDefinition.key] = obs.valueBoolean ?? false;
    byDate.set(date, bucket);
  }

  console.log('\nAI extracted vs manifest (boolean metrics):');
  let mismatches = 0;
  for (const [date, expected] of expectedByDate) {
    const actual = byDate.get(date) ?? {};
    for (const key of ['nuts_consumed', 'skin_rash_occurred'] as const) {
      const exp = expected[key] ?? false;
      const got = actual[key];
      if (got === undefined) {
        if (exp) {
          mismatches += 1;
          console.log(`  MISS ${date} ${key}: expected ${exp}, got —`);
        }
        continue;
      }
      if (got !== exp) {
        mismatches += 1;
        console.log(`  FAIL ${date} ${key}: expected ${exp}, got ${got}`);
      }
    }
  }

  for (const [date, actual] of byDate) {
    for (const [key, val] of Object.entries(actual)) {
      const exp = expectedByDate.get(date)?.[key];
      if (exp === undefined && val) {
        mismatches += 1;
        console.log(`  EXTRA ${date} ${key}: unexpected true (no manifest day or extra metric)`);
      }
    }
  }

  console.log(`\nTotal mismatches/extras: ${mismatches}`);

  console.log('\nEntry pipeline status detail:');
  for (const entry of entries) {
    const obsForEntry = observations.filter((o) => o.entryId === entry.id);
    console.log(
      `  ${entry.entryDate.toISOString().slice(0, 10)} | ${entry.processingStatus} | obs in entry=${obsForEntry.length}`,
    );
    if (entry.processingError) {
      console.log(`    error: ${entry.processingError.slice(0, 200)}`);
    }
    console.log(`    text: ${(entry.rawText ?? '').replace(/\s+/g, ' ').slice(0, 220)}...`);
  }

  console.log('\nAll observations:');
  for (const obs of observations) {
    console.log(
      `  ${obs.observedAt.toISOString().slice(0, 10)} | ${obs.metricDefinition.key} | ${obs.valueBoolean} | evidence: ${(obs.evidenceText ?? '').slice(0, 60)}`,
    );
  }

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
