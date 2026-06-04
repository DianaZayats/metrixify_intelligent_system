<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="empty">
    <p class="empty__title typo-h3">{{ title }}</p>
    <p v-if="description" class="empty__desc text-muted">{{ description }}</p>
    <div v-if="$slots.action" class="empty__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.empty {
  text-align: center;
  padding: var(--space-8) var(--space-5);
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
  border: 1px dashed rgba(225, 226, 221, 0.85);
}

.empty__desc {
  margin: var(--space-2) auto 0;
  max-width: 28rem;
}

.empty__action {
  margin-top: var(--space-5);
}
</style>
