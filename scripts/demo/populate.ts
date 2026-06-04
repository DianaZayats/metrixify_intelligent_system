#!/usr/bin/env tsx
import { prisma } from '../../apps/backend/src/shared/db/prisma.js';
import { upsertUserFromTelegram } from '../../apps/backend/src/modules/users/user.repository.js';
import { recalculateAnalyticsForUser } from '../../apps/backend/src/modules/analytics/analytics.service.js';

type MetricSeed = {
  key: string;
  title: string;
  valueType: 'number' | 'ordinal';
  unit?: string;
  scaleMin?: number;
  scaleMax?: number;
};

type DaySnapshot = {
  sleepHours: number;
  energy: number;
  stress: number;
  caffeine: number;
  focus: number;
  mood: number;
  steps: number;
  screenTimeH: number;
  workoutMinutes: number;
  hydrationGlasses: number;
};

function usage(): never {
  console.error(
    'Usage: npm run demo:populate -- [days] [--keep-data] [--user-id <id> | --telegram-user-id <id>]',
  );
  console.error('  Default: 60 days, 10 metrics, lag-friendly patterns for ±1 day analysis.');
  process.exit(1);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Deterministic noise in [-1, 1] for repeatable demos. */
function noise(index: number, channel = 0): number {
  const x = Math.sin(index * 12.9898 + channel * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function buildDayMetrics(index: number, previous: DaySnapshot | null): DaySnapshot {
  const weekly = Math.sin((index / 7) * Math.PI * 2);
  const biweekly = Math.sin((index / 14) * Math.PI * 2);
  const dow = index % 7;
  const isDeadlineWeek = Math.floor(index / 7) % 2 === 0;
  const isWorkoutDay = dow === 1 || dow === 3 || dow === 5;

  const prevCaffeine = previous?.caffeine ?? 1;
  const prevScreen = previous?.screenTimeH ?? 3;
  const prevWorkout = previous?.workoutMinutes ?? 0;
  const prevSleep = previous?.sleepHours ?? 7.2;

  const stress = clamp(
    Math.round(
      3.8 +
        weekly * 0.9 +
        (isDeadlineWeek && dow <= 2 ? 1.1 : 0) +
        (prevSleep < 6.2 ? 0.9 : 0) +
        noise(index, 1) * 0.35,
    ),
    1,
    5,
  );

  const caffeine = clamp(
    Math.round(0.8 + stress * 0.55 + (dow === 0 ? 1.2 : 0) + noise(index, 2) * 0.4),
    0,
    5,
  );

  const screenTimeH = clamp(
    Number(
      (
        2.4 +
        stress * 0.35 +
        caffeine * 0.2 -
        weekly * 0.25 +
        noise(index, 3) * 0.35
      ).toFixed(1),
    ),
    1,
    9,
  );

  const workoutMinutes = isWorkoutDay
    ? clamp(Math.round(28 + biweekly * 12 + noise(index, 4) * 8), 15, 75)
    : clamp(Math.round(noise(index, 5) > 0.85 ? 12 : 0), 0, 20);

  const sleepHours = clamp(
    Number(
      (
        7.6 -
        prevCaffeine * 0.48 -
        prevScreen * 0.38 -
        stress * 0.12 +
        workoutMinutes * 0.012 +
        weekly * 0.35 +
        noise(index, 6) * 0.4
      ).toFixed(1),
    ),
    4.5,
    9.2,
  );

  const energy = clamp(
    Math.round(
      1.4 +
        sleepHours * 0.48 -
        stress * 0.35 +
        (prevWorkout >= 25 ? 1.35 : 0) +
        biweekly * 0.4 +
        noise(index, 7) * 0.45,
    ),
    1,
    5,
  );

  const mood = clamp(
    Math.round(energy * 0.55 - stress * 0.42 + weekly * 0.35 + 1.8 + noise(index, 8) * 0.35),
    1,
    5,
  );

  const focus = clamp(
    Math.round(energy * 0.42 + mood * 0.28 - stress * 0.35 + noise(index, 9) * 0.4),
    1,
    5,
  );

  const steps = clamp(
    Math.round(3800 + energy * 1100 + workoutMinutes * 45 + weekly * 700 + noise(index, 10) * 900),
    1500,
    16000,
  );

  const hydrationGlasses = clamp(
    Math.round(5 + workoutMinutes * 0.04 - caffeine * 0.25 + noise(index, 11) * 1.2),
    2,
    12,
  );

  return {
    sleepHours,
    energy,
    stress,
    caffeine,
    focus,
    mood,
    steps,
    screenTimeH,
    workoutMinutes,
    hydrationGlasses,
  };
}

async function resetUserData(userId: string): Promise<void> {
  await prisma.correlationResult.deleteMany({ where: { userId } });
  await prisma.metricObservation.deleteMany({ where: { userId } });
  await prisma.metricDefinition.deleteMany({ where: { userId } });
  await prisma.profileFactEvidence.deleteMany({
    where: { profileFact: { userId } },
  });
  await prisma.profileFact.deleteMany({ where: { userId } });
  await prisma.aiRun.deleteMany({ where: { userId } });
  await prisma.processingJob.deleteMany({ where: { userId } });
  await prisma.entrySource.deleteMany({ where: { userId } });
  await prisma.diaryEntry.deleteMany({ where: { userId } });
}

async function seedMetricDefinitions(userId: string, metrics: MetricSeed[]) {
  const created = new Map<string, string>();
  for (const metric of metrics) {
    const def = await prisma.metricDefinition.upsert({
      where: { userId_key: { userId, key: metric.key } },
      create: {
        userId,
        key: metric.key,
        title: metric.title,
        valueType: metric.valueType,
        unit: metric.unit,
        scaleMin: metric.scaleMin,
        scaleMax: metric.scaleMax,
        createdBy: 'system',
        aliasesJson: [metric.title],
      },
      update: {
        title: metric.title,
        valueType: metric.valueType,
        unit: metric.unit,
        scaleMin: metric.scaleMin,
        scaleMax: metric.scaleMax,
        status: 'active',
      },
    });
    created.set(metric.key, def.id);
  }
  return created;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const maybeDays = args.find((a) => /^\d+$/.test(a));
  const days = maybeDays ? Number(maybeDays) : 60;
  const keepData = args.includes('--keep-data');
  const userIdArgIndex = args.indexOf('--user-id');
  const telegramIdArgIndex = args.indexOf('--telegram-user-id');
  const targetUserId = userIdArgIndex >= 0 ? args[userIdArgIndex + 1] : undefined;
  const targetTelegramUserIdRaw =
    telegramIdArgIndex >= 0 ? args[telegramIdArgIndex + 1] : undefined;

  if (!Number.isFinite(days) || days < 14 || days > 120) {
    usage();
  }
  if (targetUserId && targetTelegramUserIdRaw) {
    console.error('Use only one targeting option: --user-id OR --telegram-user-id');
    usage();
  }

  let user: { id: string } | null = null;

  if (targetUserId) {
    user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!user) {
      throw new Error(`User not found by id: ${targetUserId}`);
    }
  } else if (targetTelegramUserIdRaw) {
    const telegramUserId = BigInt(targetTelegramUserIdRaw);
    const account = await prisma.telegramAccount.findUnique({
      where: { telegramUserId },
      select: { userId: true },
    });
    if (!account) {
      throw new Error(`User not found by telegram_user_id: ${targetTelegramUserIdRaw}`);
    }
    user = { id: account.userId };
  } else {
    user = await upsertUserFromTelegram({
      telegramUserId: BigInt(900009999),
      username: 'fixture:max-demo',
      firstName: 'Max',
      lastName: 'Demo',
      languageCode: 'uk',
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { timezone: 'Europe/Kyiv', locale: 'uk' },
  });

  if (!keepData) {
    await resetUserData(user.id);
  }

  const metricSeeds: MetricSeed[] = [
    { key: 'sleep_hours', title: 'Sleep duration', valueType: 'number', unit: 'h' },
    { key: 'energy_level', title: 'Energy level', valueType: 'ordinal', scaleMin: 1, scaleMax: 5 },
    { key: 'stress_level', title: 'Stress level', valueType: 'ordinal', scaleMin: 1, scaleMax: 5 },
    { key: 'caffeine_cups', title: 'Caffeine cups', valueType: 'number', unit: 'cups' },
    { key: 'focus_quality', title: 'Focus quality', valueType: 'ordinal', scaleMin: 1, scaleMax: 5 },
    { key: 'mood_score', title: 'Mood score', valueType: 'ordinal', scaleMin: 1, scaleMax: 5 },
    { key: 'daily_steps', title: 'Daily steps', valueType: 'number', unit: 'steps' },
    { key: 'screen_time', title: 'Screen time', valueType: 'number', unit: 'h' },
    { key: 'workout_minutes', title: 'Workout minutes', valueType: 'number', unit: 'min' },
    { key: 'hydration_glasses', title: 'Hydration glasses', valueType: 'number', unit: 'glasses' },
  ];

  const metrics = await seedMetricDefinitions(user.id, metricSeeds);

  const start = addDays(new Date(), -(days - 1));
  const createdEntries: { id: string; date: Date }[] = [];
  const runKey = Date.now().toString(36);
  let previous: DaySnapshot | null = null;

  for (let i = 0; i < days; i += 1) {
    const day = addDays(start, i);
    const snapshot = buildDayMetrics(i, previous);
    previous = snapshot;

    const text = [
      `Сон ${snapshot.sleepHours.toFixed(1)} год, енергія ${snapshot.energy}/5, настрій ${snapshot.mood}/5.`,
      `Стрес ${snapshot.stress}/5, фокус ${snapshot.focus}/5.`,
      `Кава ${snapshot.caffeine} чаш., екран ${snapshot.screenTimeH.toFixed(1)} год, кроки ${snapshot.steps}.`,
      snapshot.workoutMinutes > 0
        ? `Тренування ${snapshot.workoutMinutes} хв.`
        : 'Без тренування.',
      `Вода — ${snapshot.hydrationGlasses} склянок.`,
    ].join(' ');

    const entry = await prisma.diaryEntry.create({
      data: {
        userId: user.id,
        sourceType: 'text',
        rawText: text,
        transcriptText: null,
        summaryText: `Сон ${snapshot.sleepHours.toFixed(1)} год · енергія ${snapshot.energy}/5 · стрес ${snapshot.stress}/5.`,
        entryDate: new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())),
        processingStatus: 'completed',
      },
    });

    await prisma.entrySource.create({
      data: {
        userId: user.id,
        entryId: entry.id,
        sourceType: 'text',
        idempotencyKey: `demo:max:${runKey}:${day.toISOString().slice(0, 10)}`,
      },
    });

    const observedAt = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 12, 0, 0),
    );

    const observations: Array<[string, number]> = [
      ['sleep_hours', snapshot.sleepHours],
      ['energy_level', snapshot.energy],
      ['stress_level', snapshot.stress],
      ['caffeine_cups', snapshot.caffeine],
      ['focus_quality', snapshot.focus],
      ['mood_score', snapshot.mood],
      ['daily_steps', snapshot.steps],
      ['screen_time', snapshot.screenTimeH],
      ['workout_minutes', snapshot.workoutMinutes],
      ['hydration_glasses', snapshot.hydrationGlasses],
    ];

    for (const [key, value] of observations) {
      const metricDefinitionId = metrics.get(key);
      if (!metricDefinitionId) continue;
      await prisma.metricObservation.create({
        data: {
          userId: user.id,
          entryId: entry.id,
          metricDefinitionId,
          observedAt,
          valueNumber: value,
          confidence: 1,
          evidenceText: `demo seed: ${key}=${value}`,
          source: 'system',
        },
      });
    }

    createdEntries.push({ id: entry.id, date: day });
  }

  const firstEntryId = createdEntries[0]?.id ?? null;
  const lastEntryId = createdEntries.at(-1)?.id ?? null;
  const facts = [
    {
      key: 'work_schedule',
      valueJson: { value: 'офісний графік, пік навантаження пн–ср' },
      factType: 'routine' as const,
      stability: 'stable' as const,
    },
    {
      key: 'caffeine_pattern',
      valueJson: { value: '2–3 чашки кави в дні з високим стресом; часто погіршує сон наступної ночі' },
      factType: 'habit' as const,
      stability: 'evolving' as const,
    },
    {
      key: 'sleep_sensitivity',
      valueJson: { value: 'при сні < 6.5 год падають енергія, фокус і настрій' },
      factType: 'health_context' as const,
      stability: 'stable' as const,
    },
    {
      key: 'training_rhythm',
      valueJson: { value: 'тренування вт/чт/сб; наступного дня вища енергія' },
      factType: 'routine' as const,
      stability: 'stable' as const,
    },
    {
      key: 'screen_evening',
      valueJson: { value: 'довгий екран увечері корелює з гіршим сном' },
      factType: 'habit' as const,
      stability: 'evolving' as const,
    },
  ];

  for (const fact of facts) {
    const upserted = await prisma.profileFact.upsert({
      where: { userId_key: { userId: user.id, key: fact.key } },
      create: {
        userId: user.id,
        key: fact.key,
        valueJson: fact.valueJson,
        factType: fact.factType,
        stability: fact.stability,
        confidence: 0.92,
        status: 'active',
        firstSeenEntryId: firstEntryId,
        lastSeenEntryId: lastEntryId,
        evidenceCount: 2,
      },
      update: {
        valueJson: fact.valueJson,
        factType: fact.factType,
        stability: fact.stability,
        confidence: 0.92,
        status: 'active',
        firstSeenEntryId: firstEntryId,
        lastSeenEntryId: lastEntryId,
        evidenceCount: 2,
      },
    });

    if (firstEntryId) {
      await prisma.profileFactEvidence.create({
        data: {
          profileFactId: upserted.id,
          entryId: firstEntryId,
          evidenceText: 'demo seed evidence (first period)',
        },
      });
    }
    if (lastEntryId) {
      await prisma.profileFactEvidence.create({
        data: {
          profileFactId: upserted.id,
          entryId: lastEntryId,
          evidenceText: 'demo seed evidence (recent period)',
        },
      });
    }
  }

  const recalc = await recalculateAnalyticsForUser(user.id);
  const factCount = await prisma.profileFact.count({ where: { userId: user.id } });
  const corrCount = await prisma.correlationResult.count({ where: { userId: user.id } });
  const lagBreakdown = await prisma.correlationResult.groupBy({
    by: ['lagDays'],
    where: { userId: user.id, method: 'pearson' },
    _count: { _all: true },
  });

  const topByAbs = await prisma.correlationResult.findMany({
    where: { userId: user.id, method: 'pearson' },
    orderBy: { correlationValue: 'desc' },
    take: 5,
    include: {
      metricA: { select: { title: true } },
      metricB: { select: { title: true } },
    },
  });

  console.log(`[demo:populate] userId=${user.id}`);
  if (targetTelegramUserIdRaw) {
    console.log(`[demo:populate] target=telegram_user_id:${targetTelegramUserIdRaw}`);
  } else if (targetUserId) {
    console.log(`[demo:populate] target=user_id:${targetUserId}`);
  } else {
    console.log('[demo:populate] target=fixture:max-demo');
  }
  console.log(`[demo:populate] days=${days} metrics=${metricSeeds.length} entries=${createdEntries.length}`);
  console.log(`[demo:populate] profileFacts=${factCount} correlations=${corrCount}`);
  console.log(`[demo:populate] recalcAt=${recalc.calculatedAt}`);
  console.log('[demo:populate] pearson pairs by lag (UI filter defaults to lag 0):');
  for (const row of lagBreakdown.sort((a, b) => a.lagDays - b.lagDays)) {
    console.log(`  lag ${row.lagDays >= 0 ? '+' : ''}${row.lagDays}: ${row._count._all} pairs`);
  }
  console.log('[demo:populate] strongest pearson (any lag):');
  for (const row of topByAbs) {
    const sign = row.correlationValue >= 0 ? '+' : '';
    console.log(
      `  ${row.metricA.title} · ${row.metricB.title} lag ${row.lagDays} r=${sign}${row.correlationValue.toFixed(2)} n=${row.sampleSize}`,
    );
  }
  console.log('[demo:populate] tip: on /correlations switch "When to compare" to see lag -1 / +1 results.');
}

main()
  .catch((error) => {
    console.error('[demo:populate] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
