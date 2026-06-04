<script setup lang="ts">
import type { CardVariant } from '@metrixify/design-tokens';

withDefaults(
  defineProps<{
    variant?: CardVariant;
    padding?: 'md' | 'lg';
    elevated?: boolean;
    as?: 'article' | 'section' | 'div';
  }>(),
  {
    variant: 'default',
    padding: 'md',
    elevated: false,
    as: 'article',
  },
);
</script>

<template>
  <component
    :is="as"
    class="card"
    :class="[
      `card--${variant}`,
      { 'card--lg': padding === 'lg', 'card--elevated': elevated },
    ]"
  >
    <slot />
  </component>
</template>

<style scoped>
.card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  border: 1px solid color-mix(in srgb, var(--color-border) 55%, transparent);
  box-shadow: var(--shadow-card);
  max-width: 100%;
  min-width: 0;
}

@media (max-width: 767px) {
  .card {
    padding: var(--space-4);
  }

  .card--lg {
    padding: var(--space-4);
    border-radius: var(--radius-lg);
  }
}

.card--elevated {
  border-color: transparent;
  box-shadow: var(--shadow-card);
}

.card--lg {
  padding: var(--space-6);
  border-radius: var(--radius-xl);
}

.card--muted {
  background: var(--color-surface-muted);
  border-color: transparent;
}

.card--ai {
  background: var(--color-ai-pale);
  border-color: transparent;
}

.card--mood {
  background: var(--color-peach);
  border-color: transparent;
}

.card--warm {
  background: var(--color-surface-warm);
  border-color: transparent;
}

.card--dark {
  background: var(--color-button-dark);
  border-color: transparent;
  color: var(--color-button-light);
  box-shadow: 0 16px 40px rgba(12, 13, 16, 0.18);
}

.card--dark :deep(.typo-h3),
.card--dark :deep(h2),
.card--dark :deep(h3) {
  color: var(--color-button-light);
}

.card--dark :deep(.text-muted),
.card--dark :deep(.text-small),
.card--dark :deep(.text-caption) {
  color: rgba(255, 255, 255, 0.65);
}
</style>
