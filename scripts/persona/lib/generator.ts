import type { PersonaSpec } from './spec.js';

export type GeneratedDiaryDay = {
  date: string;
  text: string;
  signals: Record<string, boolean>;
};

export type PersonaDiaryFile = {
  entryDate: string;
  text: string;
};

export type PersonaDiaryOutput = {
  manifestDays: GeneratedDiaryDay[];
  files: PersonaDiaryFile[];
};

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromPersonaId(personaId: string): number {
  let hash = 0;
  for (let i = 0; i < personaId.length; i += 1) {
    hash = (hash * 31 + personaId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function resolveGenerationSeed(spec: PersonaSpec): number {
  if (spec.generation_seed_from) {
    return seedFromPersonaId(spec.generation_seed_from);
  }
  return seedFromPersonaId(spec.id);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayBefore(isoDate: string): string {
  return addDays(isoDate, -1);
}

function resolveBooleanCooccurrence(
  rand: () => number,
  pattern: PersonaSpec['latent_patterns'][0],
): { metricA: boolean; metricB: boolean } {
  if (pattern.type !== 'boolean_cooccurrence') {
    throw new Error(`Unsupported pattern type: ${pattern.type}`);
  }

  const metricA = rand() < pattern.base_rate_a;
  let metricB = rand() < pattern.base_rate_b;

  if (metricA) {
    metricB = rand() < pattern.cooccurrence_rate;
  }

  return { metricA, metricB };
}

const UK_TEMPLATES = {
  intro: [
    'Сьогодні день був спокійний.',
    'Зранку все було звично.',
    'День пройшов без особливих подій, окрім кількох деталей.',
    'Після роботи трохи часу для себе.',
  ],
  nuts: [
    'Перекусив горіхами під час обіду.',
    'На полудні з\'їв горішкову суміш.',
    'Ввечері був перекус з арахісом.',
    'Під час прогулянки з\'їв горішки.',
  ],
  rash: [
    'Помітив висип на шкірі рук.',
    'Шкіра на зап\'ястях почала свербіти і з\'явився висип.',
    'Висип на шкірі став помітнішим до вечора.',
    'На шкірі з\'явилися червоні плями.',
  ],
  neutral: [
    'Вечеря була простою, без перекусів.',
    'Обід був звичайний, без солодощів чи горіхів.',
    'Провів час на свіжому повітрі.',
    'Трохи втомився, але без інших симптомів.',
  ],
};

const EN_TEMPLATES = {
  intro: [
    'Today was fairly ordinary.',
    'Morning started as usual.',
    'Nothing major happened, just a few small details.',
    'Had some quiet time after work.',
  ],
  nuts: [
    'Had nuts as an afternoon snack.',
    'Ate a peanut mix at lunch.',
    'Evening snack included nuts.',
    'Grabbed some nuts during a walk.',
  ],
  rash: [
    'Noticed a skin rash on my hands.',
    'My wrists started itching and a rash appeared.',
    'Skin rash became more visible by evening.',
    'Red patches showed up on my skin.',
  ],
  neutral: [
    'Simple dinner without snacks.',
    'Regular lunch without nuts or sweets.',
    'Spent some time outdoors.',
    'Felt a bit tired but no other symptoms.',
  ],
};

const UK_MONTH_GENITIVE = [
  'січня',
  'лютого',
  'березня',
  'квітня',
  'травня',
  'червня',
  'липня',
  'серпня',
  'вересня',
  'жовтня',
  'листопада',
  'грудня',
];

const UK_WEEKDAYS = [
  'неділя',
  'понеділок',
  'вівторок',
  'середа',
  'четвер',
  'п\'ятниця',
  'субота',
];

function formatExplicitDateUk(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  const monthIndex = Number(month) - 1;
  const dayNum = Number(day);
  return `${dayNum} ${UK_MONTH_GENITIVE[monthIndex] ?? month}`;
}

function formatExplicitDateEn(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date);
}

function weekdayIndexUtc(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00.000Z`).getUTCDay();
}

function describeDayEventsUk(day: GeneratedDiaryDay, metricAKey: string, metricBKey: string): string {
  const nuts = day.signals[metricAKey];
  const rash = day.signals[metricBKey];
  if (nuts && rash) {
    return 'перекусив горіхами, ввечері помітив висип на шкірі';
  }
  if (nuts) {
    return 'перекусив горіхами, без висипу';
  }
  if (rash) {
    return 'без горіхів, але був висип';
  }
  return 'без горіхів і без висипу';
}

function describeDayEventsEn(day: GeneratedDiaryDay, metricAKey: string, metricBKey: string): string {
  const nuts = day.signals[metricAKey];
  const rash = day.signals[metricBKey];
  if (nuts && rash) {
    return 'had nuts, noticed a skin rash later';
  }
  if (nuts) {
    return 'had nuts, no rash';
  }
  if (rash) {
    return 'no nuts, but had a rash';
  }
  return 'no nuts and no rash';
}

function formatRecapDayLine(
  day: GeneratedDiaryDay,
  entryDate: string,
  spec: PersonaSpec,
  metricAKey: string,
  metricBKey: string,
  useRelative: boolean,
): string {
  const events =
    spec.locale === 'uk'
      ? describeDayEventsUk(day, metricAKey, metricBKey)
      : describeDayEventsEn(day, metricAKey, metricBKey);

  if (useRelative && day.date === dayBefore(entryDate)) {
    return spec.locale === 'uk' ? `Вчора — ${events}.` : `Yesterday — ${events}.`;
  }

  if (useRelative && day.date !== entryDate) {
    const weekday = UK_WEEKDAYS[weekdayIndexUtc(day.date)]!;
    if (spec.locale === 'uk') {
      return `У ${weekday === 'середа' ? 'середу' : weekday === 'субота' ? 'суботу' : weekday === 'неділя' ? 'неділю' : weekday} (${formatExplicitDateUk(day.date)}) — ${events}.`;
    }
    const weekdayEn = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' }).format(
      new Date(`${day.date}T12:00:00.000Z`),
    );
    return `On ${weekdayEn} (${formatExplicitDateEn(day.date)}) — ${events}.`;
  }

  const label =
    spec.locale === 'uk' ? formatExplicitDateUk(day.date) : formatExplicitDateEn(day.date);
  return spec.locale === 'uk' ? `${label} — ${events}.` : `${label} — ${events}.`;
}

function chunkDays<T>(items: T[], chunkCount: number): T[][] {
  if (items.length === 0) {
    return [];
  }
  const chunks: T[][] = [];
  const size = Math.ceil(items.length / chunkCount);
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function buildWeeklyRecapFiles(
  spec: PersonaSpec,
  days: GeneratedDiaryDay[],
  cooccurrence: Extract<PersonaSpec['latent_patterns'][0], { type: 'boolean_cooccurrence' }>,
): PersonaDiaryFile[] {
  const chunks = chunkDays(days, spec.recap_count);
  return chunks.map((chunk, chunkIndex) => {
    const entryDate = chunk[chunk.length - 1]!.date;
    const intro =
      spec.locale === 'uk'
        ? `Підсумок періоду (запис ${chunkIndex + 1}/${chunks.length}, фіксую ${formatExplicitDateUk(entryDate)}).`
        : `Period recap (entry ${chunkIndex + 1}/${chunks.length}, logging on ${formatExplicitDateEn(entryDate)}).`;

    const lines = chunk.map((day, dayIndex) =>
      formatRecapDayLine(
        day,
        entryDate,
        spec,
        cooccurrence.metric_a,
        cooccurrence.metric_b,
        dayIndex === chunk.length - 2,
      ),
    );

    return {
      entryDate,
      text: [intro, ...lines].join(' '),
    };
  });
}

/** Per-day ground truth + boolean signals (same PRNG regardless of diary_format). */
export function generatePersonaDiaryDays(spec: PersonaSpec): GeneratedDiaryDay[] {
  const rand = mulberry32(resolveGenerationSeed(spec));
  const cooccurrence = spec.latent_patterns.find((p) => p.type === 'boolean_cooccurrence');
  if (!cooccurrence || cooccurrence.type !== 'boolean_cooccurrence') {
    throw new Error('Persona spec must include a boolean_cooccurrence latent pattern');
  }

  const templates = spec.locale === 'uk' ? UK_TEMPLATES : EN_TEMPLATES;
  const metricAKey = cooccurrence.metric_a;
  const metricBKey = cooccurrence.metric_b;
  const days: GeneratedDiaryDay[] = [];

  for (let offset = 0; offset < spec.calendar_days; offset += 1) {
    const date = addDays(spec.start_date, offset);
    if (rand() > spec.event_density) {
      continue;
    }

    const { metricA, metricB } = resolveBooleanCooccurrence(rand, cooccurrence);
    const parts: string[] = [];
    parts.push(templates.intro[Math.floor(rand() * templates.intro.length)]!);

    if (metricA) {
      parts.push(templates.nuts[Math.floor(rand() * templates.nuts.length)]!);
    } else {
      parts.push(templates.neutral[Math.floor(rand() * templates.neutral.length)]!);
    }

    if (metricB) {
      parts.push(templates.rash[Math.floor(rand() * templates.rash.length)]!);
    }

    days.push({
      date,
      text: parts.join(' '),
      signals: {
        [metricAKey]: metricA,
        [metricBKey]: metricB,
      },
    });
  }

  return days;
}

export function generatePersonaDiaryOutput(spec: PersonaSpec): PersonaDiaryOutput {
  const manifestDays = generatePersonaDiaryDays(spec);
  const cooccurrence = spec.latent_patterns.find((p) => p.type === 'boolean_cooccurrence');
  if (!cooccurrence || cooccurrence.type !== 'boolean_cooccurrence') {
    throw new Error('Persona spec must include a boolean_cooccurrence latent pattern');
  }

  if (spec.diary_format === 'weekly_recap') {
    return {
      manifestDays,
      files: buildWeeklyRecapFiles(spec, manifestDays, cooccurrence),
    };
  }

  return {
    manifestDays,
    files: manifestDays.map((day) => ({
      entryDate: day.date,
      text: day.text,
    })),
  };
}

/** @deprecated Use generatePersonaDiaryOutput — kept for tests importing daily list. */
export function generatePersonaDiary(spec: PersonaSpec): GeneratedDiaryDay[] {
  return generatePersonaDiaryDays(spec);
}
