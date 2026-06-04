<script setup lang="ts">
defineProps<{
  title: string;
  subtitle?: string;
}>();
</script>

<template>
  <details class="collapsible">
    <summary class="collapsible__summary">
      <span class="collapsible__text">
        <span class="collapsible__title typo-h3">{{ title }}</span>
        <span v-if="subtitle" class="collapsible__subtitle text-muted">{{ subtitle }}</span>
      </span>
      <span class="collapsible__chevron" aria-hidden="true" />
    </summary>
    <div class="collapsible__body">
      <slot />
    </div>
  </details>
</template>

<style scoped>
.collapsible {
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  border: 1px solid rgba(225, 226, 221, 0.55);
  overflow: hidden;
}

.collapsible__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.collapsible__summary::-webkit-details-marker {
  display: none;
}

.collapsible__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.collapsible__title {
  margin: 0;
}

.collapsible__subtitle {
  font-size: var(--text-small);
}

.collapsible__chevron {
  width: 0.65rem;
  height: 0.65rem;
  border-right: 2px solid var(--color-text-secondary);
  border-bottom: 2px solid var(--color-text-secondary);
  transform: rotate(45deg);
  transition: transform 0.15s ease;
  flex-shrink: 0;
}

.collapsible[open] .collapsible__chevron {
  transform: rotate(-135deg) translateY(-2px);
}

.collapsible__body {
  padding: 0 var(--space-6) var(--space-6);
  border-top: 1px solid rgba(225, 226, 221, 0.65);
  min-width: 0;
}

@media (max-width: 767px) {
  .collapsible__summary {
    padding: var(--space-4);
  }

  .collapsible__body {
    padding: 0 var(--space-4) var(--space-4);
  }
}

.collapsible__body :deep(.section:first-child) {
  margin-top: var(--space-5);
}
</style>
