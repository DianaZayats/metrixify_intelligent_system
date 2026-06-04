<script setup lang="ts">
defineProps<{
  title?: string;
  message: string;
}>();
</script>

<template>
  <div class="error-state" role="alert">
    <p v-if="title" class="error-state__title typo-h3">{{ title }}</p>
    <p class="error-state__message">{{ message }}</p>
    <div v-if="$slots.action" class="error-state__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.error-state {
  padding: var(--space-4) var(--space-5);
  border-radius: var(--radius-lg);
  border: 1px solid color-mix(in srgb, var(--color-negative) 35%, var(--color-border));
  background: color-mix(in srgb, var(--color-blush) 35%, var(--color-surface));
  box-shadow: var(--shadow-card);
}

.error-state__title {
  margin: 0 0 var(--space-2);
}

.error-state__message {
  margin: 0;
  color: var(--color-text-primary);
}

.error-state__action {
  margin-top: var(--space-4);
}
</style>
