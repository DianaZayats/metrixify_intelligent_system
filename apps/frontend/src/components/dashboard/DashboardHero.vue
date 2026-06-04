<script setup lang="ts">
import PageHeader from '../ui/PageHeader.vue';

defineProps<{
  greeting: string;
  subtitle: string;
}>();
</script>

<template>
  <PageHeader :title="greeting" :tagline="subtitle" size="hero">
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
  </PageHeader>
</template>
