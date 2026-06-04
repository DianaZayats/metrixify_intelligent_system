<script setup lang="ts">
import { computed } from 'vue';
import type { ButtonVariant } from '@metrixify/design-tokens';

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    loading?: boolean;
    block?: boolean;
    size?: 'md' | 'sm';
    /** Trailing circle arrow on primary (`dark`) buttons. Default: true for `dark`. */
    showArrow?: boolean;
  }>(),
  {
    variant: 'dark',
    type: 'button',
    disabled: false,
    loading: false,
    block: false,
    size: 'md',
    showArrow: undefined,
  },
);

const arrowVisible = computed(() => {
  if (props.showArrow === false) {
    return false;
  }
  if (props.showArrow === true) {
    return true;
  }
  return props.variant === 'dark';
});
</script>

<template>
  <button
    :type="type"
    class="btn"
    :class="[
      `btn--${variant}`,
      {
        'btn--block': block,
        'btn--sm': size === 'sm',
        'btn--loading': loading,
        'btn--with-arrow': arrowVisible,
      },
    ]"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
  >
    <template v-if="arrowVisible">
      <span class="btn__inner">
        <span class="btn__icon" aria-hidden="true">
          <span v-if="loading" class="btn__spinner btn__spinner--in-icon" />
          <svg
            v-else
            class="btn__arrow"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3.5 8h9M9 4.5 12.5 8 9 11.5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span class="btn__label" :class="{ 'btn__label--hidden': loading && !arrowVisible }">
          <slot />
        </span>
      </span>
    </template>
    <template v-else>
      <span v-if="loading" class="btn__spinner-wrap" aria-hidden="true">
        <span class="btn__spinner" />
      </span>
      <span class="btn__label" :class="{ 'btn__label--hidden': loading }">
        <slot />
      </span>
    </template>
  </button>
</template>

<style scoped>
.btn {
  --btn-press-motion: 0.4s cubic-bezier(0.33, 1, 0.68, 1);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: 44px;
  padding: 0 var(--space-6);
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  font-size: var(--text-body);
  font-weight: var(--font-weight-medium);
  letter-spacing: var(--letter-spacing-body);
  cursor: pointer;
  transition:
    background var(--btn-motion, 0.6s cubic-bezier(0.65, 0, 0.35, 1)),
    border-color var(--btn-motion, 0.6s cubic-bezier(0.65, 0, 0.35, 1)),
    color var(--btn-motion, 0.6s cubic-bezier(0.65, 0, 0.35, 1)),
    box-shadow var(--btn-press-motion),
    transform var(--btn-press-motion),
    filter var(--btn-press-motion),
    opacity 0.15s ease;
}

.btn--with-arrow {
  --btn-icon-size: 44px;
  --btn-track-pad-y: 8px;
  --btn-track-pad-x: 8px;
  --btn-motion: 0.65s cubic-bezier(0.65, 0, 0.35, 1);
  width: auto;
  max-width: 100%;
  min-height: calc(var(--btn-icon-size) + var(--btn-track-pad-y) * 2);
  padding: var(--btn-track-pad-y) var(--btn-track-pad-x);
}

.btn--sm {
  min-height: 36px;
  padding: 0 var(--space-4);
  font-size: var(--text-small);
}

.btn--sm.btn--with-arrow {
  --btn-icon-size: 36px;
  --btn-track-pad-y: 6px;
  --btn-track-pad-x: 6px;
  padding: var(--btn-track-pad-y) var(--btn-track-pad-x);
}

.btn--block {
  width: 100%;
}

.btn--dark {
  background: var(--color-button-light);
  color: var(--color-text-primary);
  border-color: var(--color-border);
}

.btn--dark.btn--with-arrow:hover:not(:disabled):not(.btn--loading) {
  background: var(--color-button-dark);
  color: var(--color-button-light);
  border-color: var(--color-button-dark);
}

.btn--dark:active:not(:disabled):not(.btn--loading) {
  transform: scale(0.99);
  box-shadow: inset 0 2px 6px rgba(12, 13, 16, 0.1);
}

.btn--dark.btn--with-arrow:active:not(:disabled):not(.btn--loading):hover {
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.28);
}

.btn--green {
  background: var(--color-primary);
  color: var(--color-button-light);
}

.btn--green:hover:not(:disabled) {
  background: var(--color-primary-muted);
}

.btn--green:active:not(:disabled):not(.btn--loading) {
  transform: scale(0.99);
  filter: brightness(0.92);
  box-shadow: inset 0 2px 6px rgba(12, 13, 16, 0.16);
}

.btn--secondary {
  background: var(--color-button-light);
  color: var(--color-text-primary);
  border-color: var(--color-border);
}

.btn--secondary:hover:not(:disabled) {
  background: var(--color-surface-muted);
}

.btn--secondary:active:not(:disabled):not(.btn--loading) {
  transform: scale(0.99);
  box-shadow: inset 0 2px 6px rgba(12, 13, 16, 0.08);
}

.btn--ghost {
  background: transparent;
  color: var(--color-text-primary);
}

.btn--ghost:hover:not(:disabled) {
  background: var(--color-surface-muted);
}

.btn--ghost:active:not(:disabled):not(.btn--loading) {
  transform: scale(0.99);
  background: var(--color-surface-muted);
}

.btn--destructive {
  background: var(--color-negative);
  color: var(--color-button-light);
}

.btn--destructive:hover:not(:disabled) {
  opacity: 0.9;
}

.btn--destructive:active:not(:disabled):not(.btn--loading) {
  transform: scale(0.99);
  filter: brightness(0.9);
  box-shadow: inset 0 2px 6px rgba(12, 13, 16, 0.2);
}

.btn--block.btn--with-arrow {
  width: 100%;
}

.btn__inner {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  width: auto;
  min-height: var(--btn-icon-size);
  padding-left: var(--space-5);
  padding-right: calc(var(--btn-icon-size) + var(--space-2));
  transition:
    padding-left var(--btn-motion),
    padding-right var(--btn-motion);
}

.btn--block.btn--with-arrow .btn__inner {
  width: 100%;
}

.btn--sm .btn__inner {
  padding-left: var(--space-4);
  padding-right: calc(var(--btn-icon-size) + var(--space-2));
}

.btn--dark.btn--with-arrow:hover:not(:disabled):not(.btn--loading) .btn__inner {
  padding-left: calc(var(--btn-icon-size) + var(--space-3));
  padding-right: var(--space-5);
}

.btn--sm.btn--dark.btn--with-arrow:hover:not(:disabled):not(.btn--loading) .btn__inner {
  padding-left: calc(var(--btn-icon-size) + var(--space-2));
  padding-right: var(--space-4);
}

.btn__label {
  position: relative;
  z-index: 1;
  white-space: nowrap;
  pointer-events: none;
}

.btn__icon {
  position: absolute;
  top: 50%;
  left: calc(100% - var(--btn-icon-size));
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--btn-icon-size);
  height: var(--btn-icon-size);
  border-radius: 50%;
  background: var(--color-button-dark);
  color: var(--color-button-light);
  transform: translateY(-50%);
  transition:
    left var(--btn-motion),
    background var(--btn-motion),
    color var(--btn-motion),
    transform var(--btn-press-motion);
}

.btn--dark.btn--with-arrow:active:not(:disabled):not(.btn--loading) .btn__icon {
  transform: translateY(-50%) scale(0.96);
}

.btn--dark.btn--with-arrow:hover:not(:disabled):not(.btn--loading) .btn__icon {
  left: 0;
  background: var(--color-button-light);
  color: var(--color-button-dark);
}

.btn__arrow {
  width: 17px;
  height: 17px;
  transform: rotate(0deg);
  transition: transform var(--btn-motion);
}

.btn--sm .btn__arrow {
  width: 15px;
  height: 15px;
}

.btn--dark.btn--with-arrow:hover:not(:disabled):not(.btn--loading) .btn__arrow {
  transform: rotate(180deg);
}

.btn:focus-visible {
  outline: 2px solid var(--color-ai);
  outline-offset: 2px;
}

.btn:disabled:not(.btn--loading) {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn--loading {
  position: relative;
  opacity: 1;
  cursor: wait;
}

.btn--loading.btn--with-arrow.btn--dark {
  background: var(--color-button-light);
  color: var(--color-text-primary);
  border-color: var(--color-border);
}

.btn--loading.btn--with-arrow.btn--dark .btn__inner {
  padding-left: var(--space-5);
  padding-right: calc(var(--btn-icon-size) + var(--space-2));
}

.btn--sm.btn--loading.btn--with-arrow.btn--dark .btn__inner {
  padding-left: var(--space-4);
  padding-right: calc(var(--btn-icon-size) + var(--space-2));
}

.btn--loading.btn--with-arrow .btn__icon {
  left: calc(100% - var(--btn-icon-size));
  background: var(--color-button-dark);
  color: var(--color-button-light);
  transform: translateY(-50%);
}

.btn--loading.btn--with-arrow .btn__arrow {
  transform: rotate(0deg);
}

.btn--loading.btn--with-arrow .btn__label {
  opacity: 0.72;
  transition: opacity var(--btn-press-motion);
}

.btn__spinner-wrap {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.btn__spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.btn__spinner--in-icon {
  width: 0.875rem;
  height: 0.875rem;
  border-color: var(--color-button-light);
  border-right-color: transparent;
}

.btn__label--hidden {
  visibility: hidden;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
