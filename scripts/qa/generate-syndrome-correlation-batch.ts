#!/usr/bin/env tsx
/**
 * Generate syndrome-track diary batch (days 26+) optimized for correlation overlap.
 * Writes fixtures/personas/qa-syndrome-correlation/diary/manifest.json
 * and docs/qa-syndrome-correlation-batch.md
 */
import fs from 'node:fs';
import path from 'node:path';

type DayPlan = {
  dayNum: number;
  iso: string;
  sleepHours: number;
  stress: 'low' | 'mid' | 'high';
  energy: 'high' | 'mid' | 'low';
  caffeineCups: number;
  symptoms: number;
  fastFoodYesterday?: boolean;
  alcoholYesterday?: boolean;
  walk: boolean;
  cleanDay?: boolean;
};

function addDays(iso: string, offset: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function stressPhrase(stress: DayPlan['stress']): string {
  if (stress === 'low') return 'низький, без сильної тривожності';
  if (stress === 'mid') return 'помірний, на рівні звичайного';
  return 'високий, вищий за звичайний';
}

function energyPhrase(energy: DayPlan['energy']): string {
  if (energy === 'high') return 'вище середньої';
  if (energy === 'mid') return 'середня';
  return 'нижче середньої';
}

function buildPlans(): DayPlan[] {
  const plans: DayPlan[] = [];
  const startIso = '2026-03-26';
  const dayCount = 30;

  for (let i = 0; i < dayCount; i += 1) {
    const dayNum = 26 + i;
    const iso = addDays(startIso, i);
    const wave = Math.sin((i / 6) * Math.PI * 2);
    const prev = plans[i - 1];

    const fastFoodYesterday = i > 0 && (i % 7 === 3 || i % 11 === 5);
    const alcoholYesterday = i > 0 && i % 9 === 4;
    const poorSleepYesterday = prev ? prev.sleepHours < 6.2 : false;

    let sleepHours = clamp(6.8 + wave * 1.1 + (i % 5 === 0 ? -1.4 : 0), 4.8, 9.2);
    if (i % 8 === 1) sleepHours = 5.2;
    if (i % 8 === 2) sleepHours = 5.8;

    let caffeineCups = clamp(Math.round(1 + wave + (i % 4 === 0 ? 1 : 0)), 0, 3);
    if (i % 6 === 0) caffeineCups = 0;

    let stress: DayPlan['stress'] = 'mid';
    if (caffeineCups >= 2 || poorSleepYesterday) stress = 'high';
    if (caffeineCups === 0 && sleepHours >= 7.5) stress = 'low';

    let symptoms = clamp(
      Math.round(
        2 +
          (stress === 'high' ? 3.5 : stress === 'mid' ? 1.5 : 0.5) +
          (poorSleepYesterday ? 1.5 : 0) +
          (fastFoodYesterday ? 2 : 0) +
          (alcoholYesterday ? 1.5 : 0) +
          wave * 0.8,
      ),
      1,
      9,
    );

    const cleanDay = i % 10 === 7 || i % 13 === 11;
    if (cleanDay) {
      symptoms = clamp(1 + (i % 2), 1, 2);
      stress = 'low';
      sleepHours = clamp(sleepHours + 1, 7, 9);
      caffeineCups = Math.min(caffeineCups, 1);
    }

    let energy: DayPlan['energy'] = 'mid';
    if (symptoms <= 2 && sleepHours >= 7) energy = 'high';
    if (symptoms >= 6 || sleepHours < 5.5) energy = 'low';

    plans.push({
      dayNum,
      iso,
      sleepHours: Math.round(sleepHours * 10) / 10,
      stress,
      energy,
      caffeineCups,
      symptoms,
      fastFoodYesterday: i > 0 ? fastFoodYesterday : undefined,
      alcoholYesterday: i > 0 ? alcoholYesterday : undefined,
      walk: i % 3 !== 1,
      cleanDay,
    });
  }

  return plans;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function renderText(plan: DayPlan): string {
  const parts = [
    `День ${plan.dayNum} (${plan.iso}):`,
    `Сон ${String(plan.sleepHours).replace('.', ',')} годин.`,
    `Стрес ${stressPhrase(plan.stress)}.`,
    `Енергія ${energyPhrase(plan.energy)}.`,
    plan.caffeineCups === 0
      ? 'Кави не пив.'
      : plan.caffeineCups === 1
        ? 'Одна чашка кави до обіду.'
        : `${plan.caffeineCups} чашки кави до обіду.`,
  ];

  if (plan.symptoms <= 2) {
    parts.push(`Симптоми слабкі, ${plan.symptoms} із 10, майже не заважали.`);
  } else if (plan.symptoms >= 6) {
    parts.push(`Симптоми ${plan.symptoms} із 10, ввечері був помітний дискомфорт.`);
  } else {
    parts.push(`Симптоми помірні, ${plan.symptoms} із 10.`);
  }

  if (plan.fastFoodYesterday) {
    parts.push('Вчора ввечері був фастфуд — бургер і картопля.');
  }
  if (plan.alcoholYesterday) {
    parts.push('Вчора ввечері був алкоголь, без пізньої вечері.');
  }
  if (plan.walk) {
    parts.push('Прогулянка 25–30 хвилин.');
  } else {
    parts.push('Активності майже не було.');
  }
  if (plan.cleanDay) {
    parts.push('Їжа спокійна, без експериментів.');
  }

  return parts.join(' ');
}

function main() {
  const plans = buildPlans();
  const manifest = {
    personaId: 'qa-syndrome-correlation',
    description:
      'Days 26–55: dense sleep/stress/caffeine/symptoms for correlation overlap (14+ paired days).',
    plantedPatterns: [
      { pair: 'stress_level ↔ symptom severity', lag: 0 },
      { pair: 'sleep duration ↔ symptoms', lag: 1 },
      { pair: 'caffeine ↔ stress', lag: 0 },
      { pair: 'fast food (yesterday mention) ↔ symptoms', lag: 1 },
    ],
    days: plans.map((plan) => ({
      date: plan.iso,
      dayNum: plan.dayNum,
      text: renderText(plan),
      signals: {
        night_sleep_duration_minutes: Math.round(plan.sleepHours * 60),
        stress_level: plan.stress,
        acute_energy_level: plan.energy,
        caffeine_intake: plan.caffeineCups,
        evening_discomfort: plan.symptoms,
        daytime_walk_occurred: plan.walk,
        fast_food_yesterday: plan.fastFoodYesterday ?? false,
      },
    })),
  };

  const root = path.resolve(process.cwd());
  const fixtureDir = path.join(root, 'fixtures/personas/qa-syndrome-correlation/diary');
  fs.mkdirSync(fixtureDir, { recursive: true });
  fs.writeFileSync(
    path.join(fixtureDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  const mdLines = [
    '# Syndrome track — correlation batch (days 26–55)',
    '',
    'Copy each block to Telegram **one per day**, or run:',
    '',
    '```bash',
    'npm run qa:seed-syndrome-batch -- 575883395',
    '```',
    '',
    'Every entry includes **sleep, stress, energy, caffeine, symptoms** for analytics overlap.',
    '',
    '---',
    '',
  ];

  for (const day of manifest.days) {
    mdLines.push(`## Day ${day.dayNum} (${day.date})`);
    mdLines.push('');
    mdLines.push('```');
    mdLines.push(day.text);
    mdLines.push('```');
    mdLines.push('');
  }

  fs.writeFileSync(path.join(root, 'docs/qa-syndrome-correlation-batch.md'), mdLines.join('\n'), 'utf8');

  console.log(`Generated ${manifest.days.length} days →`);
  console.log(`  fixtures/personas/qa-syndrome-correlation/diary/manifest.json`);
  console.log(`  docs/qa-syndrome-correlation-batch.md`);
}

main();
