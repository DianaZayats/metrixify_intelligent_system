import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tokens = JSON.parse(readFileSync(join(__dirname, '../tokens.json'), 'utf8'));

const colorMap = {
  bg: '--color-bg',
  surface: '--color-surface',
  surfaceMuted: '--color-surface-muted',
  surfaceWarm: '--color-surface-warm',
  border: '--color-border',
  textPrimary: '--color-text-primary',
  textSecondary: '--color-text-secondary',
  textTertiary: '--color-text-tertiary',
  primary: '--color-primary',
  primarySoft: '--color-primary-soft',
  primaryMuted: '--color-primary-muted',
  ai: '--color-ai',
  aiSoft: '--color-ai-soft',
  aiPale: '--color-ai-pale',
  peach: '--color-peach',
  sand: '--color-sand',
  blush: '--color-blush',
  yellowSoft: '--color-yellow-soft',
  positive: '--color-positive',
  warning: '--color-warning',
  negative: '--color-negative',
  neutral: '--color-neutral',
  correlationStrong: '--color-correlation-strong',
  correlationWeak: '--color-correlation-weak',
  buttonDark: '--color-button-dark',
  buttonLight: '--color-button-light',
  error: '--color-error',
  tagSleep: '--color-tag-sleep',
  tagMood: '--color-tag-mood',
  tagBody: '--color-tag-body',
  tagActivity: '--color-tag-activity',
  tagSymptoms: '--color-tag-symptoms',
  tagAi: '--color-tag-ai',
  tagNeutral: '--color-tag-neutral',
  nightViolet: '--color-night-violet',
  deepCurve: '--color-deep-curve',
  botVisor: '--color-bot-visor',
  accentPurple: '--color-accent-purple',
  softLavender: '--color-soft-lavender',
  lightLavender: '--color-light-lavender',
  paleMist: '--color-pale-mist',
};

const lines = [
  '/* Generated from @metrixify/design-tokens — do not edit manually */',
  ':root {',
];

for (const [key, cssVar] of Object.entries(colorMap)) {
  lines.push(`  ${cssVar}: ${tokens.color[key]};`);
}

for (const [key, value] of Object.entries(tokens.radius)) {
  lines.push(`  --radius-${key}: ${value};`);
}

for (const [key, value] of Object.entries(tokens.spacing)) {
  lines.push(`  --space-${key}: ${value};`);
}

lines.push(`  --layout-max-width: ${tokens.layout.maxWidth};`);
lines.push(`  --layout-min-width: ${tokens.layout.minWidth};`);

for (const [key, value] of Object.entries(tokens.breakpoint)) {
  lines.push(`  --breakpoint-${key}: ${value};`);
}

lines.push(`  --font-sans: ${tokens.typography.fontFamily};`);

for (const [key, value] of Object.entries(tokens.typography.letterSpacing)) {
  lines.push(`  --letter-spacing-${key}: ${value};`);
}

for (const [key, value] of Object.entries(tokens.typography.size)) {
  lines.push(`  --text-${key}: ${value};`);
}

for (const [key, value] of Object.entries(tokens.typography.weight)) {
  lines.push(`  --font-weight-${key}: ${value};`);
}

for (const [key, value] of Object.entries(tokens.typography.lineHeight)) {
  lines.push(`  --line-height-${key}: ${value};`);
}

lines.push('}');
lines.push('');

const outPath = join(__dirname, '../../../apps/frontend/src/styles/tokens.css');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`Wrote ${outPath}`);
