#!/usr/bin/env tsx
import { loadPersonaEnv, requireOpenAiKey } from './persona/lib/env.js';
import { generatePersonaDiaryOutput } from './persona/lib/generator.js';
import {
  entryDateFromIso,
  loadPersonaSpec,
  personaIdempotencyKey,
} from './persona/lib/load.js';
import { seedPersonaMetricDefinitions } from './persona/lib/persona-user.js';
import { recalculateAnalyticsForUser } from '../apps/backend/src/modules/analytics/analytics.service.js';
import { ingestPersonaTextEntry } from '../apps/backend/src/modules/entries/entry.service.js';
import { prisma } from '../apps/backend/src/shared/db/prisma.js';
import { upsertUserFromTelegram, deleteAllUserDataForUser } from '../apps/backend/src/modules/users/user.repository.js';

type Preset = 'quick' | 'full';

function usage(): never {
  console.error(
    'Usage: npm run seed:demo-entries -- --telegram-user-id <id> [--telegram-username name] [--preset quick|full] [--skip-facts] [--keep-data] [--recalculate]',
  );
  console.error(
    'PowerShell tip: if flags are stripped, run directly:',
  );
  console.error(
    '  npx tsx scripts/seed-demo-entries.ts --telegram-user-id <id> --telegram-username name --preset quick --skip-facts --recalculate',
  );
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const getFlagValue = (flag: string): string | undefined => {
    const equalsPrefix = `${flag}=`;
    const equalsMatch = argv.find((arg) => arg.startsWith(equalsPrefix));
    if (equalsMatch) {
      return equalsMatch.slice(equalsPrefix.length);
    }

    const index = argv.indexOf(flag);
    if (index === -1) {
      return undefined;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      return undefined;
    }
    return next;
  };

  const hasFlag = (flag: string): boolean =>
    argv.includes(flag) || argv.some((arg) => arg.startsWith(`${flag}=`));

  let telegramUserIdRaw = getFlagValue('--telegram-user-id');
  let telegramUsername = getFlagValue('--telegram-username') ?? null;
  let preset = (getFlagValue('--preset') ?? 'quick') as Preset;

  // npm on Windows sometimes strips `--flag` names but keeps positional values.
  if (!telegramUserIdRaw) {
    const positional = argv.filter((arg) => !arg.startsWith('--'));
    if (/^\d+$/.test(positional[0] ?? '')) {
      telegramUserIdRaw = positional[0];
      const second = positional[1];
      const third = positional[2];
      if (second === 'quick' || second === 'full') {
        preset = second;
      } else if (second) {
        telegramUsername = second;
        if (third === 'quick' || third === 'full') {
          preset = third;
        }
      }
    }
  }

  if (!telegramUserIdRaw) {
    usage();
  }

  if (preset !== 'quick' && preset !== 'full') {
    console.error('Invalid --preset (use quick or full)');
    process.exit(1);
  }

  return {
    telegramUserId: BigInt(telegramUserIdRaw),
    telegramUsername,
    preset,
    skipFacts: hasFlag('--skip-facts'),
    keepData: hasFlag('--keep-data'),
    recalculate: hasFlag('--recalculate'),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2).filter((arg) => arg !== '--'));
  loadPersonaEnv();
  requireOpenAiKey();

  const personaId = args.preset === 'quick' ? 'peanut-rash-quick' : 'peanut-rash';
  const spec = loadPersonaSpec(personaId);

  const user = await upsertUserFromTelegram({
    telegramUserId: args.telegramUserId,
    username: args.telegramUsername,
    firstName: 'Demo',
    lastName: 'Seed',
    languageCode: spec.locale,
  });

  if (user.timezone !== spec.timezone || user.locale !== spec.locale) {
    await prisma.user.update({
      where: { id: user.id },
      data: { timezone: spec.timezone, locale: spec.locale },
    });
  }

  if (!args.keepData) {
    await deleteAllUserDataForUser(user.id);
  }

  await seedPersonaMetricDefinitions(user.id, spec.metrics);

  const output = generatePersonaDiaryOutput(spec);
  console.log(
    `[seed:demo-entries] preset=${args.preset} — ${output.files.length} entries, ${output.manifestDays.length} manifest days`,
  );

  let completed = 0;
  let failed = 0;
  const seedKey = `demo-seed:${args.telegramUserId.toString()}`;

  for (const [index, file] of output.files.entries()) {
    const result = await ingestPersonaTextEntry({
      userId: user.id,
      userTimezone: spec.timezone,
      entryDate: entryDateFromIso(file.entryDate),
      rawText: file.text.trim(),
      idempotencyKey: personaIdempotencyKey(seedKey, file.entryDate),
      skipProfileFacts: args.skipFacts,
    });

    if (result.processingStatus === 'completed') {
      completed += 1;
    } else if (result.processingStatus === 'failed') {
      failed += 1;
      console.error(`[seed:demo-entries] entry ${file.entryDate} failed (${result.entryId})`);
    }

    console.log(`[seed:demo-entries] ${index + 1}/${output.files.length} — ${file.entryDate}`);
  }

  if (args.recalculate) {
    const recalc = await recalculateAnalyticsForUser(user.id);
    console.log(
      `[seed:demo-entries] recalculated ${recalc.correlationCount} pairs (official ${recalc.officialCount}, exploratory ${recalc.exploratoryCount})`,
    );
  }

  console.log(
    `[seed:demo-entries] done — user ${user.id}, telegram ${args.telegramUserId}, completed ${completed}, failed ${failed}`,
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('[seed:demo-entries] failed:', error);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
