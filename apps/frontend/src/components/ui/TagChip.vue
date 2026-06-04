<script setup lang="ts">
import type { TagVariant } from '@metrixify/design-tokens';
import { tagVariantForSlug } from '@metrixify/design-tokens';
import Badge from './Badge.vue';

const props = withDefaults(
  defineProps<{
    label: string;
    slug?: string;
    variant?: TagVariant;
  }>(),
  {
    slug: undefined,
    variant: undefined,
  },
);

const resolvedVariant = props.variant ?? (props.slug ? tagVariantForSlug(props.slug) : 'neutral');
</script>

<template>
  <Badge :variant="resolvedVariant">{{ label }}</Badge>
</template>
