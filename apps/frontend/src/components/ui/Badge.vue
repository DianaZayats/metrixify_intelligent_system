<script setup lang="ts">
import type { TagVariant } from '@metrixify/design-tokens';

withDefaults(
  defineProps<{
    variant?: TagVariant;
  }>(),
  {
    variant: 'neutral',
  },
);
</script>

<template>
  <span
    class="badge"
    :class="`badge--${variant}`"
  >
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.65rem;
  border-radius: var(--radius-pill);
  font-size: var(--text-caption);
  font-weight: var(--font-weight-medium);
  line-height: 1.35;
  color: var(--color-text-primary);
  border: 1px solid transparent;
}

.badge--neutral {
  background: var(--color-tag-neutral);
  color: var(--color-text-secondary);
}

.badge--sleep,
.badge--activity {
  background: var(--color-tag-sleep);
}

.badge--mood {
  background: var(--color-tag-mood);
}

.badge--body {
  background: var(--color-tag-body);
}

.badge--symptoms {
  background: var(--color-tag-symptoms);
}

.badge--ai {
  background: var(--color-tag-ai);
  color: var(--color-ai);
}

.badge--positive {
  background: var(--color-primary-soft);
  color: var(--color-positive);
}

.badge--warning {
  background: var(--color-yellow-soft);
  color: var(--color-warning);
}

.badge--negative {
  background: var(--color-blush);
  color: var(--color-negative);
}
</style>
