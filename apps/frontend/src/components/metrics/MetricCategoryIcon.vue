<script setup lang="ts">
import type { MetricIconCategory } from '../../lib/metric-overview';

defineProps<{
  category: MetricIconCategory;
}>();
</script>

<template>
  <svg
    class="metric-category-icon"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <!-- sleep -->
    <path
      v-if="category === 'sleep'"
      d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5Z"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- mood -->
    <g v-else-if="category === 'mood'">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.75" />
      <path
        d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
      />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
    </g>
    <!-- health -->
    <path
      v-else-if="category === 'health'"
      d="M12 20s-6.5-4.2-6.5-9.2a3.7 3.7 0 0 1 6.5-2.4 3.7 3.7 0 0 1 6.5 2.4c0 5-6.5 9.2-6.5 9.2Z"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- nutrition -->
    <g v-else-if="category === 'nutrition'">
      <path
        d="M12 3c3 4 5 7 5 10a5 5 0 0 1-10 0c0-3 2-6 5-10Z"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linejoin="round"
      />
      <path d="M12 13v4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
    </g>
    <!-- activity -->
    <path
      v-else-if="category === 'activity'"
      d="M13.5 4.5 8 20l-2.5-7.5L3 10l10.5-5.5Zm0 0L16 8l5-1.5L13.5 4.5Z"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- work -->
    <g v-else-if="category === 'work'">
      <rect x="4" y="8" width="16" height="11" rx="2" stroke="currentColor" stroke-width="1.75" />
      <path d="M9 8V6.5A2.5 2.5 0 0 1 11.5 4h1A2.5 2.5 0 0 1 15 6.5V8" stroke="currentColor" stroke-width="1.75" />
    </g>
    <!-- money -->
    <g v-else-if="category === 'money'">
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" stroke-width="1.75" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" stroke-width="1.75" />
    </g>
    <!-- default -->
    <g v-else>
      <path d="M5 18V10M10 18V6M15 18v-8M20 18V8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
    </g>
  </svg>
</template>

<style scoped>
.metric-category-icon {
  width: 1.25rem;
  height: 1.25rem;
}
</style>
