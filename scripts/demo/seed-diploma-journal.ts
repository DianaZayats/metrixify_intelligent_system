#!/usr/bin/env tsx
/**
 * Adds diploma-friendly diary entries (UK + EN, text + voice) for an existing user.
 * Does NOT delete existing data. Skips dates that already have an entry.
 */
import { prisma } from '../../apps/backend/src/shared/db/prisma.js';
import { recalculateAnalyticsForUser } from '../../apps/backend/src/modules/analytics/analytics.service.js';

const DEFAULT_TELEGRAM_USER_ID = '575883395';
const CHAT_ID = '575883395';
const TIMEZONE = 'Europe/Kyiv';

type Lang = 'uk' | 'en';
type SourceKind = 'text' | 'voice';

type DaySnapshot = {
  sleepHours: number;
  stress: number;
  energy: number;
  caffeine: number;
  symptoms: number;
  discomfort: number;
  wellbeing: number;
  walk: boolean;
  fastFood: boolean;
  fattyFood: boolean;
  lowActivity: boolean;
  alcohol: boolean;
  gymMinutes: number;
};

type MetricDefMap = Map<
  string,
  { id: string; valueType: 'number' | 'ordinal' | 'boolean' }
>;

function usage(): never {
  console.error(
    'Usage: npm run demo:seed-diploma -- [--days N] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--telegram-user-id ID]',
  );
  console.error('  Default: fill empty calendar days from 2026-01-01 to 2026-06-30 (max 90 new entries).');
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const daysIdx = args.indexOf('--days');
  const fromIdx = args.indexOf('--from');
  const toIdx = args.indexOf('--to');
  const tgIdx = args.indexOf('--telegram-user-id');

  const maxDays = daysIdx >= 0 ? Number(args[daysIdx + 1]) : 90;
  const from = fromIdx >= 0 ? args[fromIdx + 1] : '2026-01-01';
  const to = toIdx >= 0 ? args[toIdx + 1] : '2026-06-30';
  const telegramUserId = tgIdx >= 0 ? args[tgIdx + 1] : DEFAULT_TELEGRAM_USER_ID;

  if (!from || !to || !Number.isFinite(maxDays) || maxDays < 1) usage();
  return { maxDays, from, to, telegramUserId };
}

function addDays(iso: string, offset: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function noise(i: number, ch = 0): number {
  const x = Math.sin(i * 9.17 + ch * 41.03) * 19134.918;
  return (x - Math.floor(x)) * 2 - 1;
}

function buildSnapshot(index: number, prev: DaySnapshot | null): DaySnapshot {
  const weekly = Math.sin((index / 7) * Math.PI * 2);
  const dow = index % 7;
  const weekend = dow === 5 || dow === 6;

  const prevFast = prev?.fastFood ?? false;
  const prevFatty = prev?.fattyFood ?? false;
  const prevCaffeine = prev?.caffeine ?? 0;
  const prevSleep = prev?.sleepHours ?? 7;

  const fastFood = !weekend && noise(index, 1) > 0.62 && dow !== 1;
  const fattyFood = !fastFood && noise(index, 2) > 0.7;
  const alcohol = weekend && noise(index, 3) > 0.55;

  const caffeine = clamp(
    Math.round((prevSleep < 6 ? 2 : 1) + (dow === 0 ? 1 : 0) + noise(index, 4) * 1.2),
    0,
    3,
  );

  const gymMinutes =
    dow === 2 || dow === 4 ? clamp(Math.round(35 + noise(index, 5) * 15), 20, 60) : 0;

  const sleepHours = clamp(
    Number(
      (
        7.4 -
        prevCaffeine * 0.35 -
        (prevFast || prevFatty ? 0.45 : 0) -
        alcohol * 0.8 +
        gymMinutes * 0.008 +
        weekly * 0.25 +
        noise(index, 6) * 0.5
      ).toFixed(1),
    ),
    4.2,
    9.5,
  );

  const stress = clamp(
    Math.round(
      3 +
        weekly * 1.2 +
        (dow <= 1 ? 1.5 : 0) +
        (prevSleep < 6 ? 1.2 : 0) +
        (prevFast || prevFatty ? 0.8 : 0) +
        noise(index, 7) * 1.1,
    ),
    1,
    10,
  );

  const baseSymptoms = clamp(
    Math.round(
      2 +
        (prevFast ? 2.5 : 0) +
        (prevFatty ? 1.8 : 0) +
        stress * 0.35 +
        (sleepHours < 5.5 ? 1.5 : 0) +
        noise(index, 8) * 1.2,
    ),
    1,
    10,
  );

  const energy = clamp(
    Math.round(
      2 +
        sleepHours * 0.75 -
        stress * 0.45 -
        baseSymptoms * 0.2 +
        (gymMinutes > 0 ? 1.2 : 0) +
        noise(index, 9) * 0.9,
    ),
    1,
    10,
  );

  const discomfort = clamp(Math.round(baseSymptoms * 0.85 + noise(index, 10) * 0.8), 1, 10);
  const wellbeing = clamp(Math.round(energy * 0.6 - stress * 0.25 + 3 + noise(index, 11) * 0.6), 1, 10);
  const walk = gymMinutes === 0 && noise(index, 12) > -0.15;
  const lowActivity = !walk && gymMinutes === 0 && noise(index, 13) > 0.35;

  return {
    sleepHours,
    stress,
    energy,
    caffeine,
    symptoms: baseSymptoms,
    discomfort,
    wellbeing,
    walk,
    fastFood,
    fattyFood,
    lowActivity,
    alcohol,
    gymMinutes,
  };
}

function formatNarrative(lang: Lang, date: string, s: DaySnapshot, prevFast: boolean): string {
  const sleepStr = s.sleepHours.toFixed(1);
  if (lang === 'uk') {
    const parts = [
      `Запис за ${date}. Сьогодні спала ${sleepStr} год, сон ${s.sleepHours < 6 ? 'неспокійний' : 'нормальний'}.`,
      `Стрес ${s.stress} з 10, енергія ${s.energy} з 10, самопочуття зранку ${s.wellbeing} з 10.`,
      s.caffeine > 0
        ? `Випила ${s.caffeine} ${s.caffeine === 1 ? 'каву' : 'кави'}.`
        : 'Кави сьогодні не було.',
      prevFast ? 'Вчора ввечері був фастфуд — сьогодні відчуваю наслідки.' : null,
      s.fastFood ? 'Сьогодні в обід був фастфуд — бургер і картопля.' : null,
      s.fattyFood ? 'Поїла жирну їжу на вечерю.' : null,
      s.alcohol ? 'Ввечері один бокал вина з подругами.' : null,
      s.gymMinutes > 0 ? `Була в залі ${s.gymMinutes} хвилин.` : null,
      s.walk && s.gymMinutes === 0 ? 'Прогулялася після роботи близько 30 хвилин.' : null,
      s.lowActivity ? 'Мало рухалась, переважно за ноутом.' : null,
      s.symptoms >= 6
        ? `Симптоми помітні — приблизно ${s.symptoms} з 10, ввечері дискомфорт ${s.discomfort} з 10.`
        : `Симптомів мало, приблизно ${s.symptoms} з 10.`,
    ];
    return parts.filter(Boolean).join(' ');
  }

  const parts = [
    `Entry for ${date}. Today I slept ${sleepStr} hours; sleep felt ${s.sleepHours < 6 ? 'restless' : 'okay'}.`,
    `Stress ${s.stress}/10, energy ${s.energy}/10, morning wellbeing ${s.wellbeing}/10.`,
    s.caffeine > 0
      ? `Had ${s.caffeine} coffee${s.caffeine > 1 ? 's' : ''}.`
      : 'No coffee today.',
    prevFast ? 'Yesterday evening I had fast food — feeling it today.' : null,
    s.fastFood ? 'Fast food for lunch today (burger and fries).' : null,
    s.fattyFood ? 'Greasy dinner tonight.' : null,
    s.alcohol ? 'One glass of wine with friends in the evening.' : null,
    s.gymMinutes > 0 ? `Gym session for ${s.gymMinutes} minutes.` : null,
    s.walk && s.gymMinutes === 0 ? 'Walked for about 30 minutes after work.' : null,
    s.lowActivity ? 'Mostly sedentary, long screen time.' : null,
    s.symptoms >= 6
      ? `Symptoms around ${s.symptoms}/10; evening discomfort ${s.discomfort}/10.`
      : `Mild symptoms, about ${s.symptoms}/10.`,
  ];
  return parts.filter(Boolean).join(' ');
}

function formatSummary(lang: Lang, s: DaySnapshot): string {
  if (lang === 'uk') {
    return `Сон ${s.sleepHours.toFixed(1)} год · стрес ${s.stress}/10 · енергія ${s.energy}/10 · симптоми ${s.symptoms}/10.`;
  }
  return `Sleep ${s.sleepHours.toFixed(1)}h · stress ${s.stress}/10 · energy ${s.energy}/10 · symptoms ${s.symptoms}/10.`;
}

async function loadMetricDefs(userId: string): Promise<MetricDefMap> {
  const rows = await prisma.metricDefinition.findMany({
    where: { userId, status: 'active' },
    select: { id: true, key: true, valueType: true },
  });
  const map: MetricDefMap = new Map();
  for (const row of rows) {
    map.set(row.key, { id: row.id, valueType: row.valueType as 'number' | 'ordinal' | 'boolean' });
  }
  return map;
}

async function existingDates(userId: string, from: string, to: string): Promise<Set<string>> {
  const rows = await prisma.diaryEntry.findMany({
    where: {
      userId,
      entryDate: {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T00:00:00.000Z`),
      },
    },
    select: { entryDate: true },
  });
  return new Set(rows.map((r) => r.entryDate.toISOString().slice(0, 10)));
}

async function createObservations(
  userId: string,
  entryId: string,
  observedAt: Date,
  metrics: MetricDefMap,
  s: DaySnapshot,
  lang: Lang,
): Promise<number> {
  const sleepMin = Math.round(s.sleepHours * 60);
  const uk = lang === 'uk';
  const specs: Array<{
    key: string;
    number?: number;
    boolean?: boolean;
    evidence: string;
  }> = [
    {
      key: 'night_sleep_duration_minutes',
      number: sleepMin,
      evidence: uk ? `спала ${s.sleepHours.toFixed(1)} год` : `slept ${s.sleepHours.toFixed(1)} hours`,
    },
    {
      key: 'stress_level',
      number: s.stress,
      evidence: uk ? `Стрес ${s.stress} з 10` : `Stress ${s.stress}/10`,
    },
    {
      key: 'acute_energy_level',
      number: s.energy,
      evidence: uk ? `енергія ${s.energy} з 10` : `energy ${s.energy}/10`,
    },
    {
      key: 'caffeine_intake',
      number: s.caffeine,
      evidence: uk
        ? s.caffeine > 0
          ? `${s.caffeine} кави`
          : 'Кави сьогодні не було'
        : s.caffeine > 0
          ? `${s.caffeine} coffee`
          : 'No coffee today',
    },
    {
      key: 'symptom_severity',
      number: s.symptoms,
      evidence: uk ? `Симптоми ${s.symptoms} з 10` : `Symptoms ${s.symptoms}/10`,
    },
    {
      key: 'evening_discomfort',
      number: s.discomfort,
      evidence: uk ? `дискомфорт ${s.discomfort} з 10` : `discomfort ${s.discomfort}/10`,
    },
    {
      key: 'morning_wellbeing',
      number: s.wellbeing,
      evidence: uk ? `самопочуття зранку ${s.wellbeing} з 10` : `morning wellbeing ${s.wellbeing}/10`,
    },
    {
      key: 'daytime_walk_occurred',
      boolean: s.walk && s.gymMinutes === 0,
      evidence: uk ? 'Прогулялася' : 'Walked',
    },
    {
      key: 'fast_food_breakfast',
      boolean: s.fastFood,
      evidence: uk ? 'фастфуд' : 'fast food',
    },
    {
      key: 'fatty_food_consumed',
      boolean: s.fattyFood,
      evidence: uk ? 'жирну їжу' : 'greasy food',
    },
    {
      key: 'low_activity_day',
      boolean: s.lowActivity,
      evidence: uk ? 'мало рухалась' : 'sedentary',
    },
    {
      key: 'alcohol_consumed',
      boolean: s.alcohol,
      evidence: uk ? 'вино' : 'wine',
    },
  ];

  if (s.gymMinutes > 0 && metrics.has('gym_session_duration_minutes')) {
    specs.push({
      key: 'gym_session_duration_minutes',
      number: s.gymMinutes,
      evidence: uk ? `зал ${s.gymMinutes} хв` : `gym ${s.gymMinutes} min`,
    });
  }

  let count = 0;
  for (const spec of specs) {
    const def = metrics.get(spec.key);
    if (!def) continue;
    if (def.valueType === 'boolean' && spec.boolean !== true) continue;

    await prisma.metricObservation.create({
      data: {
        userId,
        entryId,
        metricDefinitionId: def.id,
        observedAt,
        valueNumber: def.valueType !== 'boolean' ? spec.number ?? null : null,
        valueBoolean: def.valueType === 'boolean' ? spec.boolean ?? null : null,
        confidence: 0.88,
        evidenceText: spec.evidence,
        source: 'ai',
      },
    });
    count += 1;
  }
  return count;
}

async function main(): Promise<void> {
  const { maxDays, from, to, telegramUserId } = parseArgs();

  const account = await prisma.telegramAccount.findUnique({
    where: { telegramUserId: BigInt(telegramUserId) },
    select: { userId: true, firstName: true, username: true },
  });
  if (!account) {
    throw new Error(`Telegram user not found: ${telegramUserId}`);
  }

  const userId = account.userId;
  await prisma.user.update({
    where: { id: userId },
    data: { timezone: TIMEZONE, locale: 'uk' },
  });

  const metrics = await loadMetricDefs(userId);
  if (metrics.size === 0) {
    throw new Error('No metric definitions for user — run pipeline on at least one entry first.');
  }

  const taken = await existingDates(userId, from, to);
  const emptyDates: string[] = [];
  for (let d = from; d <= to && emptyDates.length < maxDays; d = addDays(d, 1)) {
    if (!taken.has(d)) emptyDates.push(d);
  }

  if (emptyDates.length === 0) {
    console.log('[demo:seed-diploma] No empty dates in range — nothing to add.');
    return;
  }

  let messageId = 409381000;
  let prev: DaySnapshot | null = null;
  let prevFast = false;
  let created = 0;
  let voiceCount = 0;
  let ukCount = 0;
  let enCount = 0;

  for (let i = 0; i < emptyDates.length; i += 1) {
    const date = emptyDates[i]!;
    const snapshot = buildSnapshot(i, prev);
    const lang: Lang = i % 3 === 0 ? 'en' : 'uk';
    const sourceKind: SourceKind = i % 7 === 2 || i % 11 === 5 ? 'voice' : 'text';

    const narrative = formatNarrative(lang, date, snapshot, prevFast);
    const summary = formatSummary(lang, snapshot);
    const entryDate = new Date(`${date}T00:00:00.000Z`);
    const observedAt = new Date(`${date}T12:00:00.000Z`);
    const createdAt = new Date(`${date}T${sourceKind === 'voice' ? '19' : '09'}:${String(10 + (i % 40)).padStart(2, '0')}:00.000Z`);

    messageId += 1;
    const idempotencyKey = `telegram:${messageId}`;
    const durationSeconds = 12 + (i % 35);

    const entry = await prisma.diaryEntry.create({
      data: {
        userId,
        sourceType: sourceKind,
        rawText: narrative,
        transcriptText: sourceKind === 'voice' ? narrative : null,
        summaryText: summary,
        entryDate,
        processingStatus: 'completed',
        metadataJson:
          sourceKind === 'voice'
            ? {
                telegram: {
                  chatId: CHAT_ID,
                  inboundMessageId: String(messageId),
                  summaryMessageId: String(messageId + 1),
                },
              }
            : undefined,
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.entrySource.create({
      data: {
        userId,
        entryId: entry.id,
        sourceType: sourceKind,
        idempotencyKey,
        telegramMessageId: BigInt(messageId),
        metadataJson:
          sourceKind === 'voice'
            ? { telegramFileId: `diploma_voice_${date}`, durationSeconds }
            : { channel: 'telegram', seeded: true },
      },
    });

    await createObservations(userId, entry.id, observedAt, metrics, snapshot, lang);

    prev = snapshot;
    prevFast = snapshot.fastFood || snapshot.fattyFood;
    created += 1;
    if (sourceKind === 'voice') voiceCount += 1;
    if (lang === 'uk') ukCount += 1;
    else enCount += 1;
  }

  const recalc = await recalculateAnalyticsForUser(userId);
  const totals = await prisma.diaryEntry.groupBy({
    by: ['sourceType'],
    where: { userId },
    _count: { _all: true },
  });

  console.log(`[demo:seed-diploma] user=${userId} (${account.firstName ?? account.username ?? telegramUserId})`);
  console.log(`[demo:seed-diploma] added=${created} (uk=${ukCount}, en=${enCount}, voice=${voiceCount}, text=${created - voiceCount})`);
  console.log(`[demo:seed-diploma] date range filled: ${emptyDates[0]} … ${emptyDates[emptyDates.length - 1]}`);
  console.log('[demo:seed-diploma] totals by source:');
  for (const row of totals) {
    console.log(`  ${row.sourceType}: ${row._count._all}`);
  }
  console.log(
    `[demo:seed-diploma] correlations=${recalc.correlationCount} (official ${recalc.officialCount}, exploratory ${recalc.exploratoryCount})`,
  );
}

main()
  .catch((err) => {
    console.error('[demo:seed-diploma] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
