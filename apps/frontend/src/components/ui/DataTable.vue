<script setup lang="ts">
withDefaults(
  defineProps<{
    caption?: string;
    /** Stack rows as labeled cards on narrow viewports instead of horizontal page scroll. */
    responsive?: boolean;
    compact?: boolean;
    stickyHeader?: boolean;
  }>(),
  {
    responsive: true,
    compact: false,
    stickyHeader: true,
  },
);
</script>

<template>
  <div
    class="table-wrap"
    :class="{
      'table-wrap--responsive': responsive,
      'table-wrap--scroll': !responsive,
      'table-wrap--compact': compact,
      'table-wrap--sticky': stickyHeader,
    }"
  >
    <p v-if="caption" class="table-wrap__caption text-caption">{{ caption }}</p>
    <div class="table-scroll">
      <table class="data-table">
        <slot />
      </table>
    </div>
  </div>
</template>

<style scoped>
.table-wrap {
  max-width: 100%;
  min-width: 0;
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  border: 1px solid color-mix(in srgb, var(--color-border) 55%, transparent);
  overflow: hidden;
}

.table-wrap__caption {
  margin: 0;
  padding: var(--space-4) var(--space-4) 0;
}

.table-scroll {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.table-wrap--scroll .table-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.table-wrap--sticky .table-scroll {
  max-height: min(70vh, 42rem);
  overflow: auto;
}

.data-table {
  width: 100%;
  min-width: 36rem;
  border-collapse: collapse;
  font-size: var(--text-small);
}

.table-wrap--compact .data-table :deep(th),
.table-wrap--compact .data-table :deep(td) {
  padding: var(--space-2) var(--space-3);
}

.data-table :deep(th),
.data-table :deep(td) {
  text-align: left;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid color-mix(in srgb, var(--color-border) 65%, transparent);
  vertical-align: top;
}

.data-table :deep(th) {
  position: relative;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  font-size: var(--text-caption);
  letter-spacing: var(--letter-spacing-body);
  white-space: nowrap;
  background: var(--color-surface-muted);
}

.data-table :deep(thead th:first-child) {
  border-top-left-radius: var(--radius-lg);
}

.data-table :deep(thead th:last-child) {
  border-top-right-radius: var(--radius-lg);
}

.table-wrap--sticky .data-table :deep(thead th) {
  position: sticky;
  top: 0;
  z-index: 1;
  box-shadow: 0 1px 0 var(--color-border);
}

.data-table :deep(tbody tr) {
  transition: background 0.12s ease;
}

.data-table :deep(tbody tr:hover) {
  background: color-mix(in srgb, var(--color-primary-soft) 35%, var(--color-surface));
}

.data-table :deep(tbody tr:last-child td) {
  border-bottom: none;
}

.data-table :deep(code) {
  word-break: break-all;
}

.data-table :deep(td.cell-num),
.data-table :deep(th.cell-num) {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.data-table :deep(a) {
  font-weight: var(--font-weight-medium);
  text-decoration: none;
}

.data-table :deep(a:hover) {
  text-decoration: underline;
  text-underline-offset: 0.15em;
}

.data-table :deep(.row-actions) {
  white-space: nowrap;
}

@media (max-width: 767px) {
  .table-wrap--responsive .table-scroll {
    overflow-x: visible;
    padding: var(--space-3);
  }

  .table-wrap--responsive .data-table :deep(thead) {
    display: none;
  }

  .table-wrap--responsive .data-table :deep(tbody tr) {
    display: block;
    margin-bottom: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    background: var(--color-surface-muted);
    border: 1px solid color-mix(in srgb, var(--color-border) 55%, transparent);
  }

  .table-wrap--responsive .data-table :deep(tbody tr:last-child) {
    margin-bottom: 0;
  }

  .table-wrap--responsive .data-table :deep(tbody tr:hover) {
    background: var(--color-surface-warm);
  }

  .table-wrap--responsive .data-table :deep(td) {
    display: grid;
    grid-template-columns: minmax(5.5rem, 42%) minmax(0, 1fr);
    gap: var(--space-2) var(--space-3);
    align-items: start;
    padding: var(--space-2) 0;
    border-bottom: none;
    white-space: normal;
    word-break: break-word;
  }

  .table-wrap--responsive .data-table :deep(td::before) {
    content: attr(data-label);
    font-weight: var(--font-weight-semibold);
    font-size: var(--text-caption);
    color: var(--color-text-secondary);
  }

  .table-wrap--responsive .data-table :deep(td:last-child) {
    padding-bottom: 0;
  }
}
</style>
