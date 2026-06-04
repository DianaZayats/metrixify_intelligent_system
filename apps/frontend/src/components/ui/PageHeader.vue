<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string;
    tagline?: string;
    size?: 'page' | 'hero';
  }>(),
  {
    size: 'page',
  },
);
</script>

<template>
  <header class="page-header" :class="`page-header--${size}`">
    <div class="page-header__text">
      <h1 :class="size === 'hero' ? 'typo-hero' : 'typo-h1'">{{ title }}</h1>
      <p v-if="tagline" class="page-header__tagline text-muted">{{ tagline }}</p>
    </div>
    <div v-if="$slots.actions" class="page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-6);
  border-radius: var(--radius-xl);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  min-width: 0;
  max-width: 100%;
}

.page-header__text {
  min-width: 0;
  flex: 1 1 12rem;
}

.page-header--page {
  align-items: flex-start;
}

.page-header--hero {
  align-items: flex-end;
}

.page-header__text h1 {
  margin: 0;
  letter-spacing: var(--letter-spacing-h2);
}

.page-header--hero .page-header__text h1 {
  letter-spacing: var(--letter-spacing-hero);
}

.page-header__tagline {
  margin: var(--space-2) 0 0;
  max-width: 36rem;
  font-size: var(--text-body);
}

.page-header__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

@media (max-width: 599px) {
  .page-header {
    padding: var(--space-4);
    border-radius: var(--radius-lg);
  }

  .page-header__actions {
    width: 100%;
  }

  .page-header__actions :deep(.btn) {
    flex: 1 1 auto;
    justify-content: center;
  }
}
</style>
