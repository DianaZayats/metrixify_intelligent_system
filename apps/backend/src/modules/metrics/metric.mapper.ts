import type { MetricDefinition, MetricObservation } from '@prisma/client';
import type { AppLocale, MetricDefinitionListItem, MetricObservationItem } from '@metrixify/shared-types';
import {
  parseLocalizedString,
  parseTagsI18nMap,
  resolveLocalized,
  resolveTagLabel,
} from '@metrixify/shared-types';
import { parseAliasesJson, parseTagsJson } from './metric-normalization.js';

type ObservationMetadata = {
  observedAtPrecision: MetricObservationItem['observedAtPrecision'];
  narrativeOrder: number | null;
};

function parseObservationMetadata(metadataJson: unknown): ObservationMetadata {
  if (!metadataJson || typeof metadataJson !== 'object' || Array.isArray(metadataJson)) {
    return { observedAtPrecision: null, narrativeOrder: null };
  }

  const metadata = metadataJson as Record<string, unknown>;
  const precision = metadata.observedAtPrecision;
  const narrativeOrder = metadata.narrativeOrder;

  return {
    observedAtPrecision:
      precision === 'exact' || precision === 'inferred' || precision === 'date_only'
        ? precision
        : null,
    narrativeOrder: typeof narrativeOrder === 'number' ? narrativeOrder : null,
  };
}

export function resolveMetricTitle(definition: MetricDefinition, locale: AppLocale): string {
  return resolveLocalized(parseLocalizedString(definition.titleI18n), locale, definition.title);
}

export function resolveMetricDescription(
  definition: MetricDefinition,
  locale: AppLocale,
): string | null {
  if (definition.descriptionI18n) {
    const resolved = resolveLocalized(
      parseLocalizedString(definition.descriptionI18n),
      locale,
      definition.description,
    );
    return resolved || null;
  }
  return definition.description;
}

export function resolveMetricTags(
  definition: MetricDefinition,
  locale: AppLocale,
): string[] {
  const slugs = parseTagsJson(definition.tagsJson);
  const tagsI18n = parseTagsI18nMap(definition.tagsI18n);
  return slugs.map((slug) => resolveTagLabel(slug, tagsI18n, locale));
}

export function formatObservationValue(
  observation: Pick<MetricObservation, 'valueNumber' | 'valueText' | 'valueBoolean'>,
  definition?: Pick<MetricDefinition, 'valueType' | 'unit' | 'scaleMin' | 'scaleMax'>,
  locale: AppLocale = 'en',
): string {
  if (observation.valueBoolean !== null) {
    if (locale === 'uk') {
      return observation.valueBoolean ? 'так' : 'ні';
    }
    return observation.valueBoolean ? 'yes' : 'no';
  }

  if (observation.valueNumber !== null) {
    const unit = definition?.unit?.trim();
    if (definition?.valueType === 'ordinal' && definition.scaleMax !== null) {
      const scaleMin = definition.scaleMin ?? 1;
      return `${observation.valueNumber} (${scaleMin}–${definition.scaleMax})`;
    }
    return unit ? `${observation.valueNumber} ${unit}` : String(observation.valueNumber);
  }

  if (observation.valueText !== null) {
    return observation.valueText;
  }

  return '—';
}

export function toObservationItem(
  observation: MetricObservation & { metricDefinition: MetricDefinition },
  locale: AppLocale = 'en',
): MetricObservationItem {
  const metadata = parseObservationMetadata(observation.metadataJson);
  const definition = observation.metricDefinition;

  return {
    id: observation.id,
    entryId: observation.entryId,
    metricDefinitionId: observation.metricDefinitionId,
    metricKey: definition.key,
    metricTitle: resolveMetricTitle(definition, locale),
    valueType: definition.valueType,
    unit: definition.unit,
    scaleMin: definition.scaleMin,
    scaleMax: definition.scaleMax,
    valueNumber: observation.valueNumber,
    valueText: observation.valueText,
    valueBoolean: observation.valueBoolean,
    valueDisplay: formatObservationValue(observation, definition, locale),
    confidence: observation.confidence,
    evidenceText: observation.evidenceText,
    observedAt: observation.observedAt.toISOString(),
    observedAtPrecision: metadata.observedAtPrecision,
    narrativeOrder: metadata.narrativeOrder,
    createdAt: observation.createdAt.toISOString(),
  };
}

export function toMetricListItem(
  definition: MetricDefinition & {
    observationCount: number;
    lastObservedAt: Date | null;
  },
  locale: AppLocale = 'en',
): MetricDefinitionListItem {
  return {
    id: definition.id,
    key: definition.key,
    title: resolveMetricTitle(definition, locale),
    description: resolveMetricDescription(definition, locale),
    valueType: definition.valueType,
    unit: definition.unit,
    scaleMin: definition.scaleMin,
    scaleMax: definition.scaleMax,
    aliases: parseAliasesJson(definition.aliasesJson),
    tags: resolveMetricTags(definition, locale),
    status: definition.status,
    observationCount: definition.observationCount,
    lastObservedAt: definition.lastObservedAt?.toISOString() ?? null,
    createdAt: definition.createdAt.toISOString(),
  };
}
