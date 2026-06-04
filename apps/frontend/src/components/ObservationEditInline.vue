<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { MetricObservationItem } from '@metrixify/shared-types';
import { deleteObservation, patchObservation, type UpdateObservationPayload } from '../api/metrics';
import { useAppLocale } from '../composables/useAppLocale';
import Button from './ui/Button.vue';

const props = defineProps<{
  observation: MetricObservationItem;
  compact?: boolean;
}>();

const emit = defineEmits<{
  updated: [observation: MetricObservationItem];
  deleted: [observationId: string];
}>();

const { t } = useAppLocale();

const editing = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const draftNumber = ref('');
const draftBoolean = ref(false);
const draftText = ref('');

const isBoolean = computed(() => props.observation.valueType === 'boolean');
const isCategory = computed(() => props.observation.valueType === 'category');
const isNumeric = computed(
  () => props.observation.valueType === 'number' || props.observation.valueType === 'ordinal',
);

function resetDraft() {
  draftNumber.value =
    props.observation.valueNumber != null ? String(props.observation.valueNumber) : '';
  draftBoolean.value = props.observation.valueBoolean === true;
  draftText.value = props.observation.valueText ?? '';
  error.value = null;
}

function startEdit() {
  resetDraft();
  editing.value = true;
}

function cancelEdit() {
  editing.value = false;
  error.value = null;
}

function buildPayload(): UpdateObservationPayload {
  const payload: UpdateObservationPayload = { editedVia: 'api' };
  if (isBoolean.value) {
    payload.valueBoolean = draftBoolean.value;
  } else if (isCategory.value) {
    payload.valueText = draftText.value.trim() || null;
  } else if (isNumeric.value) {
    const parsed = Number(draftNumber.value);
    if (!Number.isFinite(parsed)) {
      throw new Error(t('observationEdit.invalidNumber'));
    }
    if (props.observation.scaleMin != null && parsed < props.observation.scaleMin) {
      throw new Error(t('observationEdit.outOfRange'));
    }
    if (props.observation.scaleMax != null && parsed > props.observation.scaleMax) {
      throw new Error(t('observationEdit.outOfRange'));
    }
    payload.valueNumber = parsed;
  }
  return payload;
}

async function saveEdit() {
  saving.value = true;
  error.value = null;
  try {
    const payload = buildPayload();
    const updated = await patchObservation(props.observation.id, payload);
    emit('updated', updated);
    editing.value = false;
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('observationEdit.saveFailed');
  } finally {
    saving.value = false;
  }
}

async function removeObservation() {
  if (!window.confirm(t('observationEdit.deleteConfirm'))) {
    return;
  }
  saving.value = true;
  error.value = null;
  try {
    await deleteObservation(props.observation.id);
    emit('deleted', props.observation.id);
    editing.value = false;
  } catch (e) {
    error.value = e instanceof Error ? e.message : t('observationEdit.deleteFailed');
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.observation.id,
  () => {
    editing.value = false;
    resetDraft();
  },
);
</script>

<template>
  <div class="obs-edit" :class="{ 'obs-edit--compact': compact }">
    <template v-if="!editing">
      <Button variant="ghost" size="sm" @click="startEdit">{{ t('observationEdit.edit') }}</Button>
    </template>

    <form v-else class="obs-edit__form" @submit.prevent="saveEdit">
      <label v-if="isBoolean" class="obs-edit__field">
        <span>{{ t('observationEdit.valueLabel') }}</span>
        <select v-model="draftBoolean" class="obs-edit__input">
          <option :value="true">{{ t('observationEdit.yes') }}</option>
          <option :value="false">{{ t('observationEdit.no') }}</option>
        </select>
      </label>

      <label v-else-if="isCategory" class="obs-edit__field">
        <span>{{ t('observationEdit.valueLabel') }}</span>
        <input v-model="draftText" type="text" class="obs-edit__input" />
      </label>

      <label v-else class="obs-edit__field">
        <span>{{ t('observationEdit.valueLabel') }}</span>
        <input
          v-model="draftNumber"
          type="number"
          step="any"
          class="obs-edit__input"
          :min="observation.scaleMin ?? undefined"
          :max="observation.scaleMax ?? undefined"
          required
        />
        <span v-if="observation.scaleMin != null && observation.scaleMax != null" class="obs-edit__hint">
          {{ observation.scaleMin }}–{{ observation.scaleMax }}
        </span>
      </label>

      <p v-if="error" class="obs-edit__error">{{ error }}</p>

      <div class="obs-edit__actions">
        <Button type="submit" size="sm" :loading="saving">{{ t('observationEdit.save') }}</Button>
        <Button type="button" variant="ghost" size="sm" :disabled="saving" @click="cancelEdit">
          {{ t('observationEdit.cancel') }}
        </Button>
        <Button type="button" variant="destructive" size="sm" :disabled="saving" @click="removeObservation">
          {{ t('observationEdit.delete') }}
        </Button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.obs-edit {
  margin-top: var(--space-2);
}

.obs-edit--compact {
  margin-top: var(--space-1);
}

.obs-edit__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-muted);
}

.obs-edit__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--text-small);
}

.obs-edit__input {
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font: inherit;
  background: var(--color-surface);
}

.obs-edit__hint {
  font-size: var(--text-caption);
  color: var(--color-text-secondary);
}

.obs-edit__error {
  margin: 0;
  font-size: var(--text-small);
  color: var(--color-negative, #b42318);
}

.obs-edit__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
