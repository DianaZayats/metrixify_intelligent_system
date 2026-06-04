import tokens from '../tokens.json' with { type: 'json' };

export type CardVariant = 'default' | 'muted' | 'ai' | 'mood' | 'warm' | 'dark';
export type ButtonVariant = 'dark' | 'green' | 'secondary' | 'ghost' | 'destructive';
export type TagVariant =
  | 'neutral'
  | 'sleep'
  | 'mood'
  | 'body'
  | 'activity'
  | 'symptoms'
  | 'ai'
  | 'positive'
  | 'warning'
  | 'negative';

export const designTokens = tokens;

export const TAG_VARIANTS: TagVariant[] = [
  'neutral',
  'sleep',
  'mood',
  'body',
  'activity',
  'symptoms',
  'ai',
  'positive',
  'warning',
  'negative',
];

export const CARD_VARIANTS: CardVariant[] = ['default', 'muted', 'ai', 'mood', 'warm', 'dark'];

export const BUTTON_VARIANTS: ButtonVariant[] = [
  'dark',
  'green',
  'secondary',
  'ghost',
  'destructive',
];

/** Map normalized metric tag slugs to semantic chip variants. */
export const METRIC_TAG_VARIANT_MAP: Record<string, TagVariant> = {
  sleep: 'sleep',
  mood: 'mood',
  energy: 'body',
  'mental-health': 'mood',
  fitness: 'activity',
  nutrition: 'body',
  work: 'neutral',
  productivity: 'neutral',
  social: 'mood',
  routine: 'neutral',
  health: 'body',
  habits: 'neutral',
};

export function tagVariantForSlug(slug: string): TagVariant {
  return METRIC_TAG_VARIANT_MAP[slug] ?? 'neutral';
}
