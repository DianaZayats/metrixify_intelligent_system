#!/usr/bin/env tsx
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadPersonaEnv, requireOpenAiKey } from './lib/env.js';
import { recalculateAnalyticsForUser } from '../../apps/backend/src/modules/analytics/analytics.service.js';
import { ingestPersonaTextEntry } from '../../apps/backend/src/modules/entries/entry.service.js';
import { prisma } from '../../apps/backend/src/shared/db/prisma.js';
import {
  assertPersonaIdMatches,
  entryDateFromIso,
  loadExpectedCorrelations,
  loadPersonaSpec,
  parseDiaryFilename,
  personaIdempotencyKey,
} from './lib/load.js';
import { getPersonaDiaryDir } from './lib/paths.js';
import {
  countEntriesByStatus,
  ensurePersonaUser,
  loadPersonaCorrelationRows,
  resetPersonaUserData,
  seedPersonaMetricDefinitions,
} from './lib/persona-user.js';
import { printAnalyzeReport } from './lib/report.js';
import { syncPersonaObservationsFromManifest } from './lib/sync-observations.js';
import { verifyCorrelations } from './lib/verify.js';

function usage(): never {
  console.error(
    'Usage: npm run persona:analyze -- <persona-id> [--keep-data] [--skip-facts] [--skip-manifest-sync]',
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const personaId = args[0];
  const keepData = args.includes('--keep-data');
  const skipFacts = args.includes('--skip-facts');
  const skipManifestSync = args.includes('--skip-manifest-sync');

  if (!personaId) {
    usage();
  }

  loadPersonaEnv();
  requireOpenAiKey();

  const spec = loadPersonaSpec(personaId);
  assertPersonaIdMatches(spec, personaId);
  const expected = loadExpectedCorrelations(personaId);

  const diaryDir = getPersonaDiaryDir(personaId);
  const diaryFiles = readdirSync(diaryDir)
    .map((name) => ({ name, date: parseDiaryFilename(name) }))
    .filter((item): item is { name: string; date: string } => item.date !== null)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (diaryFiles.length === 0) {
    console.error(`[persona:analyze] No diary files in ${diaryDir}. Run persona:generate first.`);
    process.exit(1);
  }

  const user = await ensurePersonaUser(spec);
  if (!keepData) {
    await resetPersonaUserData(user.id);
  }
  await seedPersonaMetricDefinitions(user.id, spec.metrics);

  let completed = 0;
  let failed = 0;

  for (const [index, file] of diaryFiles.entries()) {
    const text = readFileSync(resolve(diaryDir, file.name), 'utf8').trim();
    if (!text) {
      continue;
    }

    const result = await ingestPersonaTextEntry({
      userId: user.id,
      userTimezone: user.timezone,
      entryDate: entryDateFromIso(file.date),
      rawText: text,
      idempotencyKey: personaIdempotencyKey(personaId, file.date),
      skipProfileFacts: skipFacts,
    });

    if (result.processingStatus === 'completed') {
      completed += 1;
    } else if (result.processingStatus === 'failed') {
      failed += 1;
      console.error(`[persona:analyze] entry ${file.date} failed (${result.entryId})`);
    }

    if ((index + 1) % 5 === 0 || index + 1 === diaryFiles.length) {
      console.log(`[persona:analyze] ingested ${index + 1}/${diaryFiles.length} entries…`);
    }
  }

  if (!skipManifestSync) {
    const synced = await syncPersonaObservationsFromManifest({
      personaId,
      userId: user.id,
      spec,
    });
    console.log(`[persona:analyze] synced ${synced} ground-truth observations from manifest`);
  } else {
    console.log('[persona:analyze] skipped manifest sync (--skip-manifest-sync)');
  }

  const recalc = await recalculateAnalyticsForUser(user.id);
  console.log(
    `[persona:analyze] recalculated ${recalc.correlationCount} correlation rows (official ${recalc.officialCount}, exploratory ${recalc.exploratoryCount}) at ${recalc.calculatedAt}`,
  );

  const rows = await loadPersonaCorrelationRows(user.id);
  const verify = verifyCorrelations({
    rows: rows.map((row) => ({
      id: row.id,
      metricAKey: row.metricA.key,
      metricBKey: row.metricB.key,
      method: row.method,
      lagDays: row.lagDays,
      sampleSize: row.sampleSize,
      correlationValue: row.correlationValue,
    })),
    required: expected.required,
    optional: expected.optional,
    extraThreshold: expected.extra_threshold,
  });

  printAnalyzeReport({
    personaId,
    userId: user.id,
    diaryDays: diaryFiles.length,
    pipelineCompleted: completed,
    pipelineFailed: failed,
    verify,
  });

  const statusCounts = await countEntriesByStatus(user.id);
  const statusLine = statusCounts.map((row) => `${row.processingStatus}:${row._count._all}`).join(', ');
  console.log(`[persona:analyze] entry statuses: ${statusLine}`);

  await prisma.$disconnect();

  if (verify.failedRequired > 0 || failed > 0) {
    process.exit(1);
  }
}

main().catch(async (error) => {
  console.error('[persona:analyze] failed:', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
