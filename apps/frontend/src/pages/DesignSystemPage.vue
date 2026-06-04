<script setup lang="ts">
import {
  BUTTON_VARIANTS,
  CARD_VARIANTS,
  TAG_VARIANTS,
  designTokens,
} from '@metrixify/design-tokens';
import {
  AppShell,
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  SectionBlock,
  TagChip,
} from '../components/ui';
import { useAppLocale } from '../composables/useAppLocale';

const { t } = useAppLocale();

const colorGroups = [
  {
    title: 'Base',
    swatches: [
      { name: 'bg', cssVar: '--color-bg', hex: designTokens.color.bg },
      { name: 'surface', cssVar: '--color-surface', hex: designTokens.color.surface },
      { name: 'surfaceMuted', cssVar: '--color-surface-muted', hex: designTokens.color.surfaceMuted },
      { name: 'surfaceWarm', cssVar: '--color-surface-warm', hex: designTokens.color.surfaceWarm },
      { name: 'border', cssVar: '--color-border', hex: designTokens.color.border },
    ],
  },
  {
    title: 'Text',
    swatches: [
      { name: 'textPrimary', cssVar: '--color-text-primary', hex: designTokens.color.textPrimary },
      { name: 'textSecondary', cssVar: '--color-text-secondary', hex: designTokens.color.textSecondary },
      { name: 'textTertiary', cssVar: '--color-text-tertiary', hex: designTokens.color.textTertiary },
    ],
  },
  {
    title: 'Brandbook',
    swatches: [
      { name: 'nightViolet', cssVar: '--color-night-violet', hex: designTokens.color.nightViolet },
      { name: 'deepCurve', cssVar: '--color-deep-curve', hex: designTokens.color.deepCurve },
      { name: 'botVisor', cssVar: '--color-bot-visor', hex: designTokens.color.botVisor },
      { name: 'accentPurple', cssVar: '--color-accent-purple', hex: designTokens.color.accentPurple },
      { name: 'softLavender', cssVar: '--color-soft-lavender', hex: designTokens.color.softLavender },
      { name: 'lightLavender', cssVar: '--color-light-lavender', hex: designTokens.color.lightLavender },
      { name: 'paleMist', cssVar: '--color-pale-mist', hex: designTokens.color.paleMist },
    ],
  },
  {
    title: 'Brand',
    swatches: [
      { name: 'primary', cssVar: '--color-primary', hex: designTokens.color.primary },
      { name: 'primarySoft', cssVar: '--color-primary-soft', hex: designTokens.color.primarySoft },
      { name: 'ai', cssVar: '--color-ai', hex: designTokens.color.ai },
      { name: 'aiPale', cssVar: '--color-ai-pale', hex: designTokens.color.aiPale },
      { name: 'buttonDark', cssVar: '--color-button-dark', hex: designTokens.color.buttonDark },
    ],
  },
  {
    title: 'Semantic tags',
    swatches: [
      { name: 'tagSleep', cssVar: '--color-tag-sleep', hex: designTokens.color.tagSleep },
      { name: 'tagMood', cssVar: '--color-tag-mood', hex: designTokens.color.tagMood },
      { name: 'tagBody', cssVar: '--color-tag-body', hex: designTokens.color.tagBody },
      { name: 'tagSymptoms', cssVar: '--color-tag-symptoms', hex: designTokens.color.tagSymptoms },
      { name: 'tagAi', cssVar: '--color-tag-ai', hex: designTokens.color.tagAi },
    ],
  },
] as const;

const sampleRows = [
  { metric: 'Wellbeing', value: '3 / 5', tag: 'mood' },
  { metric: 'Sleep duration', value: '6h 20m', tag: 'sleep' },
  { metric: 'Morning walk', value: '35 min', tag: 'activity' },
];
</script>

<template>
  <AppShell :title="t('designSystem.title')" :show-nav="false" show-design-link>
    <PageHeader
      :title="t('designSystem.title')"
      :tagline="t('designSystem.subtitle')"
    />

    <Card variant="warm" padding="lg" class="notice">
      <Badge variant="warning">{{ t('designSystem.removeNotice') }}</Badge>
    </Card>

    <SectionBlock :title="t('designSystem.colors')">
      <div v-for="group in colorGroups" :key="group.title" class="color-group">
        <h3 class="typo-h3">{{ group.title }}</h3>
        <div class="swatch-grid">
          <div v-for="swatch in group.swatches" :key="swatch.name" class="swatch">
            <div class="swatch__chip" :style="{ background: `var(${swatch.cssVar})` }" />
            <p class="swatch__name">{{ swatch.name }}</p>
            <p class="swatch__hex text-caption">{{ swatch.hex }}</p>
          </div>
        </div>
      </div>
    </SectionBlock>

    <SectionBlock :title="t('designSystem.typography')">
      <Card>
        <p class="typo-hero">AI Diary Bot</p>
        <p class="text-muted">Lavender brand palette — Inter typography unchanged.</p>
        <p class="typo-h1">Heading level 1</p>
        <p class="typo-h2">Heading level 2</p>
        <p class="typo-h3">Heading level 3</p>
        <p>Body text — personal AI journaling with soft SaaS aesthetics.</p>
        <p class="text-caption">Caption / metadata text</p>
        <Badge variant="ai">AI insight</Badge>
      </Card>
    </SectionBlock>

    <SectionBlock :title="t('designSystem.spacing')">
      <div class="radius-row">
        <div v-for="size in ['sm', 'md', 'lg', 'xl', '2xl', 'pill']" :key="size" class="radius-chip">
          radius-{{ size }}
        </div>
      </div>
    </SectionBlock>

    <SectionBlock :title="t('designSystem.buttons')">
      <Card variant="muted" padding="lg" class="button-showcase">
        <p class="text-muted">Primary CTA — hover to slide; hold click for pressed state.</p>
        <Button variant="dark">Read more</Button>
      </Card>
      <div class="button-grid">
        <Button v-for="variant in BUTTON_VARIANTS" :key="variant" :variant="variant" :show-arrow="false">
          {{ variant }}
        </Button>
        <Button variant="dark" disabled>Disabled</Button>
        <Button variant="dark" loading>Loading</Button>
      </div>
    </SectionBlock>

    <SectionBlock :title="t('designSystem.cards')">
      <div class="grid grid--2">
        <Card v-for="variant in CARD_VARIANTS" :key="variant" :variant="variant">
          <h3 class="typo-h3">{{ variant }} card</h3>
          <p class="text-muted">Soft rounded container for content blocks.</p>
        </Card>
      </div>
      <div class="tag-row">
        <TagChip v-for="variant in TAG_VARIANTS" :key="variant" :label="variant" :variant="variant" />
      </div>
    </SectionBlock>

    <SectionBlock :title="t('designSystem.table')">
      <Card>
        <DataTable>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              <th>Tag</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in sampleRows" :key="row.metric">
              <td>{{ row.metric }}</td>
              <td>{{ row.value }}</td>
              <td><TagChip :label="row.tag" :slug="row.tag" /></td>
            </tr>
          </tbody>
        </DataTable>
      </Card>
    </SectionBlock>

    <SectionBlock :title="t('designSystem.feedback')">
      <div class="grid grid--2">
        <Card><LoadingState /></Card>
        <Card>
          <EmptyState title="No entries yet" description="Send a message to your Telegram bot." />
        </Card>
        <Card>
          <ErrorState title="Error" message="Something went wrong while loading data." />
        </Card>
      </div>
    </SectionBlock>
  </AppShell>
</template>

<style scoped>
.notice {
  margin-bottom: var(--space-6);
}

.color-group {
  margin-bottom: var(--space-6);
}

.swatch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--space-3);
}

.swatch__chip {
  height: 64px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.swatch__name {
  margin: var(--space-2) 0 0;
  font-size: var(--text-small);
  font-weight: var(--font-weight-medium);
}

.swatch__hex {
  margin: 0;
}

.radius-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.radius-chip {
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  font-size: var(--text-caption);
}

.radius-chip:nth-child(1) {
  border-radius: var(--radius-sm);
}
.radius-chip:nth-child(2) {
  border-radius: var(--radius-md);
}
.radius-chip:nth-child(3) {
  border-radius: var(--radius-lg);
}
.radius-chip:nth-child(4) {
  border-radius: var(--radius-xl);
}
.radius-chip:nth-child(5) {
  border-radius: var(--radius-2xl);
}
.radius-chip:nth-child(6) {
  border-radius: var(--radius-pill);
}

.button-showcase {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
  background: var(--color-button-dark);
}

.button-showcase .text-muted {
  color: var(--color-text-tertiary);
}

.button-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-4);
}
</style>
