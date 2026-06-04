<script setup lang="ts">
import { computed } from 'vue';
import { useAppLocale } from '../../composables/useAppLocale';

const props = defineProps<{
  page: number;
  pageSize: number;
  total: number;
}>();

const emit = defineEmits<{
  'update:page': [page: number];
}>();

const { t } = useAppLocale();

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));

const hasPrevious = computed(() => props.page > 1);
const hasNext = computed(() => props.page < totalPages.value);

const rangeFrom = computed(() => (props.page - 1) * props.pageSize + 1);
const rangeTo = computed(() => Math.min(props.page * props.pageSize, props.total));

function goTo(nextPage: number) {
  const clamped = Math.min(Math.max(1, nextPage), totalPages.value);
  if (clamped !== props.page) {
    emit('update:page', clamped);
  }
}
</script>

<template>
  <nav
    v-if="total > pageSize"
    class="pagination"
    :aria-label="t('pagination.label')"
  >
    <p class="pagination__summary">
      {{ t('pagination.range', { from: rangeFrom, to: rangeTo, total }) }}
    </p>
    <div class="pagination__controls">
      <button
        type="button"
        class="pagination__btn"
        :disabled="!hasPrevious"
        @click="goTo(page - 1)"
      >
        {{ t('pagination.previous') }}
      </button>
      <span class="pagination__status">
        {{ t('pagination.pageOf', { page, pages: totalPages }) }}
      </span>
      <button
        type="button"
        class="pagination__btn"
        :disabled="!hasNext"
        @click="goTo(page + 1)"
      >
        {{ t('pagination.next') }}
      </button>
    </div>
  </nav>
</template>

<style scoped>
.pagination {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.pagination__summary {
  margin: 0;
  font-size: var(--text-small);
  color: var(--color-text-secondary);
  text-align: center;
}

.pagination__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
}

.pagination__status {
  min-width: 7rem;
  text-align: center;
  font-size: var(--text-small);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.pagination__btn {
  min-height: 40px;
  padding: 0 var(--space-4);
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-primary);
  font: inherit;
  font-size: var(--text-small);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.pagination__btn:hover:not(:disabled) {
  background: var(--color-primary-soft);
  border-color: color-mix(in srgb, var(--color-accent-purple) 35%, transparent);
}

.pagination__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
