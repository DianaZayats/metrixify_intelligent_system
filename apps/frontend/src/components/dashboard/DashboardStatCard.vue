<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  highlight?: boolean;
}>();
</script>

<template>
  <article class="stat" :class="{ 'stat--highlight': highlight }">
    <p class="stat__label">{{ label }}</p>
    <p class="stat__value">{{ value }}</p>
  </article>
</template>

<style scoped>
.stat {
  padding: var(--space-5);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  min-height: 6rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

@media (max-width: 639px) {
  .stat {
    padding: var(--space-4);
    min-height: auto;
  }

  .stat__value {
    font-size: clamp(1.25rem, 6vw, 1.5rem);
  }
}

.stat--highlight {
  background: var(--brand-gradient-accent);
  color: var(--color-button-light);
  box-shadow: var(--shadow-card-strong);
}

.stat__label {
  margin: 0;
  font-size: var(--text-small);
  opacity: 0.85;
}

.stat:not(.stat--highlight) .stat__label {
  color: var(--color-text-secondary);
}

.stat__value {
  margin: var(--space-3) 0 0;
  font-size: clamp(1.5rem, 4vw, var(--text-h2));
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-h2);
  line-height: var(--line-height-tight);
  word-break: break-word;
}

.stat--highlight .stat__value {
  color: var(--color-button-light);
}

.stat:not(.stat--highlight) .stat__value {
  color: var(--color-text-primary);
}
</style>
