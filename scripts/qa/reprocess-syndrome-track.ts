#!/usr/bin/env tsx
/**
 * Reprocess all syndrome-track diary entries (rawText contains "День N").
 * Usage: npx tsx scripts/qa/reprocess-syndrome-track.ts [telegramUserId] [--days 2,8,15]
 */
import { loadPersonaEnv, requireOpenAiKey } from '../persona/lib/env.js';
import { reprocessEntryMetricsForUser } from '../../apps/backend/src/modules/entries/entry.service.js';
import { prisma } from '../../apps/backend/src/shared/db/prisma.js';

function parseDayFilter(argv: string[]): Set<number> | null {
  const daysArg = argv.find((a) => a.startsWith('--days='));
  if (!daysArg) {
    return null;
  }
  const raw = daysArg.slice('--days='.length);
  if (!raw.trim()) {
    return null;
  }
  return new Set(
    raw
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((n) => Number.isFinite(n) && n > 0),
  );
}

function dayFromRawText(rawText: string | null): number | null {
  const match = rawText?.match(/День\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

async function main(): Promise<void> {
  loadPersonaEnv();
  requireOpenAiKey();

  const telegramArg = process.argv[2];
  const dayFilter = parseDayFilter(process.argv.slice(2));

  let user = telegramArg
    ? await prisma.user.findFirst({
        where: { telegramAccounts: { some: { telegramUserId: BigInt(telegramArg) } } },
      })
    : null;

  if (!user) {
    const candidates = await prisma.diaryEntry.groupBy({
      by: ['userId'],
      where: { rawText: { contains: 'День' } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    });
    const top = candidates[0];
    if (top) {
      user = await prisma.user.findUnique({ where: { id: top.userId } });
      console.log(
        `[reprocess-syndrome] auto-selected user ${user?.id} (${top._count.id} syndrome entries)`,
      );
    }
  }

  if (!user) {
    console.error('User not found — pass telegramUserId as first argument');
    process.exit(1);
  }

  const allEntries = await prisma.diaryEntry.findMany({
    where: { userId: user.id, rawText: { contains: 'День' } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, rawText: true, entryDate: true, processingStatus: true },
  });

  const entries = allEntries.filter((entry) => {
    const day = dayFromRawText(entry.rawText);
    if (day === null) {
      return false;
    }
    if (dayFilter && !dayFilter.has(day)) {
      return false;
    }
    return true;
  });

  entries.sort((a, b) => (dayFromRawText(a.rawText) ?? 0) - (dayFromRawText(b.rawText) ?? 0));

  console.log(
    `[reprocess-syndrome] user ${user.id} — ${entries.length} entries` +
      (dayFilter ? ` (filter: days ${[...dayFilter].join(', ')})` : ''),
  );

  let completed = 0;
  let failed = 0;

  for (const [index, entry] of entries.entries()) {
    const day = dayFromRawText(entry.rawText);
    const headerDate = entry.rawText?.match(/\((\d{4}-\d{2}-\d{2})\)/)?.[1] ?? '?';
    console.log(
      `[reprocess-syndrome] ${index + 1}/${entries.length} — day ${day} (${headerDate}) status=${entry.processingStatus}`,
    );

    try {
      const result = await reprocessEntryMetricsForUser(entry.id, user.id, user.timezone);
      const obs = await prisma.metricObservation.count({ where: { entryId: entry.id } });
      if (result.processingStatus === 'completed') {
        completed += 1;
        console.log(`  ✓ completed — ${obs} observations`);
      } else {
        failed += 1;
        console.error(`  ✗ status ${result.processingStatus} — ${obs} observations`);
      }
    } catch (error) {
      failed += 1;
      console.error(`  ✗ failed:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`[reprocess-syndrome] done — completed ${completed}, failed ${failed}`);
}

main()
  .catch((error) => {
    console.error('[reprocess-syndrome] fatal:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
