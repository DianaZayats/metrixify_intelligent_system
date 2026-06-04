/**
 * Suggested life-domain tags for metrics. AI and UI may use these; storage allows any normalized slug.
 * Not the same as value_type `category` (nominal observation value).
 */
export const SUGGESTED_METRIC_TAGS = [
  'sleep',
  'mood',
  'energy',
  'mental-health',
  'fitness',
  'nutrition',
  'work',
  'productivity',
  'social',
  'routine',
  'health',
  'habits',
] as const;

export type SuggestedMetricTag = (typeof SUGGESTED_METRIC_TAGS)[number];
