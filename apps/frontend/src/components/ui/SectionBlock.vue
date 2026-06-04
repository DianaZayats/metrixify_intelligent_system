<script setup lang="ts">
defineProps<{
  title?: string;
}>();
</script>

<template>
  <section class="section">
    <h2 v-if="title" class="section__title typo-h3">{{ title }}</h2>
    <slot />
  </section>
</template>

<style scoped>
.section {
  margin-top: var(--space-8);
}

.section:first-child {
  margin-top: 0;
}

.section__title {
  margin-bottom: var(--space-4);
}
</style>
