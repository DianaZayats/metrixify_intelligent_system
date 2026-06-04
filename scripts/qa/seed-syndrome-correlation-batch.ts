#!/usr/bin/env tsx
/**
 * Ingest qa-syndrome-correlation batch (days 26–55) via full AI pipeline.
 * Usage: npm run qa:seed-syndrome-batch -- [telegramUserId] [--skip-facts] [--recalculate]
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadPersonaEnv, requireOpenAiKey } from '../persona/lib/env.js';
import { recalculateAnalyticsForUser } from '../../apps/backend/src/modules/analytics/analytics.service.js';
import { ingestPersonaTextEntry } from '../../apps/backend/src/modules/entries/entry.service.js';
import { prisma } from '../../apps/backend/src/shared/db/prisma.js';
import { upsertUserFromTelegram } from '../../apps/backend/src/modules/users/user.repository.js';

type Manifest = {
  days: Array<{ date: string; dayNum: number; text: string }>;
};

async function main() {
  loadPersonaEnv();
  requireOpenAiKey();

  const argv = process.argv.slice(2).filter((a) => a !== '--');
  const skipFacts = argv.includes('--skip-facts');
  const recalculate = argv.includes('--recalculate') || !argv.includes('--no-recalculate');
  const telegramArg = argv.find((a) => /^\d+$/.test(a));

  const user = telegramArg
    ? await prisma.user.findFirst({
        where: { telegramAccounts: { some: { telegramUserId: BigInt(telegramArg) } } },
      })
    : null;
  const resolved =
    user ??
    (await prisma.user.findFirst({
      where: { diaryEntries: { some: { rawText: { contains: 'День' } } } },
      orderBy: { createdAt: 'asc' },
    }));

  if (!resolved) {
    console.error('User not found — pass telegramUserId');
    process.exit(1);
  }

  const manifestPath = path.resolve(
    process.cwd(),
    'fixtures/personas/qa-syndrome-correlation/diary/manifest.json',
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as Manifest;

  console.log(`[seed] user ${resolved.id} — ${manifest.days.length} entries`);

  let ok = 0;
  let fail = 0;

  for (const [index, day] of manifest.days.entries()) {
    const entryDate = new Date(`${day.date}T00:00:00.000Z`);
    const idempotencyKey = `qa-syndrome-correlation:${day.date}`;
    console.log(`[seed] ${index + 1}/${manifest.days.length} — day ${day.dayNum} (${day.date})`);

    try {
      const result = await ingestPersonaTextEntry({
        userId: resolved.id,
        userTimezone: resolved.timezone,
        entryDate,
        rawText: day.text,
        idempotencyKey,
        skipProfileFacts: skipFacts,
      });
      if (result.processingStatus === 'completed') {
        ok += 1;
      } else {
        fail += 1;
        console.error(`  status ${result.processingStatus}`);
      }
    } catch (error) {
      fail += 1;
      console.error(`  failed:`, error instanceof Error ? error.message : error);
    }
  }

  if (recalculate) {
    const stats = await recalculateAnalyticsForUser(resolved.id);
    console.log('[seed] analytics', stats);
  }

  console.log(`[seed] done — ok ${ok}, fail ${fail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
