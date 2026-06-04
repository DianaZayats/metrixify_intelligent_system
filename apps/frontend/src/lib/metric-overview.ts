import type { MetricDefinitionListItem, MetricObservationItem } from '@metrixify/shared-types';

export type MetricIconCategory =
  | 'sleep'
  | 'mood'
  | 'health'
  | 'nutrition'
  | 'activity'
  | 'work'
  | 'money'
  | 'default';

const KEY_TO_CATEGORY: Record<string, MetricIconCategory> = {
  sleep_hours: 'sleep',
  sleep: 'sleep',
  energy_level: 'activity',
  daily_steps: 'activity',
  workout_minutes: 'activity',
  steps: 'activity',
  stress_level: 'mood',
  mood_score: 'mood',
  caffeine_cups: 'nutrition',
  hydration_glasses: 'nutrition',
  focus_quality: 'work',
  screen_time: 'work',
};

const TAG_TO_CATEGORY: Record<string, MetricIconCategory> = {
  sleep: 'sleep',
  rest: 'sleep',
  nap: 'sleep',
  mood: 'mood',
  wellbeing: 'mood',
  mental: 'mood',
  stress: 'mood',
  health: 'health',
  symptoms: 'health',
  skin: 'health',
  body: 'health',
  nutrition: 'nutrition',
  food: 'nutrition',
  habits: 'nutrition',
  diet: 'nutrition',
  fitness: 'activity',
  workout: 'activity',
  activity: 'activity',
  exercise: 'activity',
  run: 'activity',
  gym: 'activity',
  work: 'work',
  productivity: 'work',
  job: 'work',
  career: 'work',
  project: 'work',
  money: 'money',
  finance: 'money',
  spending: 'money',
};

export type MetricCardTheme = {
  start: string;
  end: string;
  foreground: string;
  iconBg: string;
};

const CATEGORY_THEMES: Record<MetricIconCategory, MetricCardTheme> = {
  sleep: {
    start: '#3B2F68',
    end: '#7E67CC',
    foreground: '#FFFFFF',
    iconBg: 'rgba(255, 255, 255, 0.18)',
  },
  activity: {
    start: '#7E67CC',
    end: '#B7A7EA',
    foreground: '#FFFFFF',
    iconBg: 'rgba(255, 255, 255, 0.18)',
  },
  mood: {
    start: '#B7A7EA',
    end: '#D9CFFD',
    foreground: '#171827',
    iconBg: 'rgba(23, 24, 39, 0.08)',
  },
  health: {
    start: '#C40F3A',
    end: '#E8A4B8',
    foreground: '#FFFFFF',
    iconBg: 'rgba(255, 255, 255, 0.18)',
  },
  nutrition: {
    start: '#2B2948',
    end: '#7E67CC',
    foreground: '#FFFFFF',
    iconBg: 'rgba(255, 255, 255, 0.18)',
  },
  work: {
    start: '#171827',
    end: '#2B2948',
    foreground: '#FFFFFF',
    iconBg: 'rgba(255, 255, 255, 0.16)',
  },
  money: {
    start: '#9A7B2E',
    end: '#D9CFFD',
    foreground: '#171827',
    iconBg: 'rgba(23, 24, 39, 0.08)',
  },
  default: {
    start: '#7E67CC',
    end: '#3B2F68',
    foreground: '#FFFFFF',
    iconBg: 'rgba(255, 255, 255, 0.18)',
  },
};

export function resolveMetricIconCategory(metricKey: string, tags: string[]): MetricIconCategory {
  const fromKey = KEY_TO_CATEGORY[metricKey.toLowerCase()];
  if (fromKey) {
    return fromKey;
  }
  for (const tag of tags) {
    const category = TAG_TO_CATEGORY[tag.toLowerCase()];
    if (category) {
      return category;
    }
  }
  return 'default';
}

export function resolveMetricCardTheme(category: MetricIconCategory): MetricCardTheme {
  return CATEGORY_THEMES[category];
}

export function resolveMetricIconCategoryFromTags(tags: string[]): MetricIconCategory {
  return resolveMetricIconCategory('', tags);
}

export type MetricActivityBadge = {
  direction: 'up' | 'down';
  percent: number;
};

/** Compare observation count in last 7 days vs the prior 7 days — works for any metric type. */
export function computeMetricActivityBadge(
  observations: MetricObservationItem[],
  metricId: string,
): MetricActivityBadge | null {
  const metricObs = observations.filter((obs) => obs.metricDefinitionId === metricId);
  if (metricObs.length === 0) {
    return null;
  }

  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const last7Start = now - sevenDaysMs;
  const prev7Start = now - 2 * sevenDaysMs;

  let last7 = 0;
  let prev7 = 0;

  for (const obs of metricObs) {
    const time = new Date(obs.observedAt).getTime();
    if (time >= last7Start) {
      last7 += 1;
    } else if (time >= prev7Start) {
      prev7 += 1;
    }
  }

  if (last7 === 0 && prev7 === 0) {
    return null;
  }

  if (prev7 === 0) {
    return last7 > 0 ? { direction: 'up', percent: 100 } : null;
  }

  const change = Math.round(((last7 - prev7) / prev7) * 100);
  if (change === 0) {
    return null;
  }

  return {
    direction: change > 0 ? 'up' : 'down',
    percent: Math.abs(change),
  };
}

export function pickFeaturedMetricId(metrics: MetricDefinitionListItem[]): string | null {
  const active = metrics.filter((metric) => metric.status === 'active');
  if (active.length === 0) {
    return null;
  }

  return [...active].sort((a, b) => {
    const aTime = a.lastObservedAt ? new Date(a.lastObservedAt).getTime() : 0;
    const bTime = b.lastObservedAt ? new Date(b.lastObservedAt).getTime() : 0;
    if (bTime !== aTime) {
      return bTime - aTime;
    }
    return b.observationCount - a.observationCount;
  })[0]!.id;
}

export function latestObservationForMetric(
  observations: MetricObservationItem[],
  metricId: string,
): MetricObservationItem | undefined {
  return observations.find((obs) => obs.metricDefinitionId === metricId);
}
