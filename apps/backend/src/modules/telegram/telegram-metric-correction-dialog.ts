import type { MetricDefinition, MetricObservation, TelegramConversationTurn } from '@prisma/client';

const DEICTIC_CORRECTION =
  /(?:^|[\s,.:;!?—–-])(эту|этой|this|that|цієї|цю|її|it)(?:\s|$|[\s,.:;!?])|(?:^|[\s,.:;!?—–-])(эту метрику|this metric|цю метрику)(?:$|[\s,.:;!?])/i;

const CORRECTION_ACK_TITLE =
  /✓ (?:Оновлено|Додано|Прибрано|Архівовано|Updated|Added|Removed|Archived): ([^—\n]+)/;

export function isDeicticCorrectionMessage(text: string): boolean {
  return DEICTIC_CORRECTION.test(text.trim());
}

export function parseMetricTitleFromCorrectionAck(text: string): string | null {
  const match = text.match(CORRECTION_ACK_TITLE);
  return match?.[1]?.trim() ?? null;
}

export function findLastCorrectionEntryId(
  recentTurns: TelegramConversationTurn[],
  allowedIds: Set<string>,
): string | null {
  for (const turn of recentTurns) {
    if (
      (turn.turnType === 'correction_user' || turn.turnType === 'correction_ack') &&
      turn.entryId &&
      allowedIds.has(turn.entryId)
    ) {
      return turn.entryId;
    }
  }
  return null;
}

export function findLastCorrectedMetricTitle(
  recentTurns: TelegramConversationTurn[],
  entryId: string,
): string | null {
  for (const turn of recentTurns) {
    if (
      turn.turnType === 'correction_ack' &&
      turn.role === 'bot' &&
      turn.entryId === entryId
    ) {
      const title = parseMetricTitleFromCorrectionAck(turn.text);
      if (title) {
        return title;
      }
    }
  }
  return null;
}

function normalizeMatchText(value: string): string {
  return value.trim().toLowerCase();
}

function definitionMatchesText(
  definition: Pick<MetricDefinition, 'key' | 'title' | 'aliasesJson'>,
  messageText: string,
): boolean {
  const normalizedMessage = normalizeMatchText(messageText);
  if (normalizedMessage.includes(normalizeMatchText(definition.title))) {
    return true;
  }
  if (normalizedMessage.includes(normalizeMatchText(definition.key.replace(/_/g, ' ')))) {
    return true;
  }

  const aliases =
    definition.aliasesJson && Array.isArray(definition.aliasesJson)
      ? (definition.aliasesJson as string[])
      : [];
  return aliases.some((alias) =>
    normalizedMessage.includes(normalizeMatchText(alias)),
  );
}

export function findDefinitionMatchingMessageText(
  messageText: string,
  definitions: MetricDefinition[],
): MetricDefinition | null {
  const matches = definitions.filter((definition) =>
    definitionMatchesText(definition, messageText),
  );
  if (matches.length === 1) {
    return matches[0] ?? null;
  }
  if (matches.length > 1) {
    return (
      matches.sort(
        (left, right) => right.title.length - left.title.length,
      )[0] ?? null
    );
  }
  return null;
}

export function findObservationByMetricTitle(
  observations: Array<MetricObservation & { metricDefinition: MetricDefinition }>,
  metricTitle: string,
): (MetricObservation & { metricDefinition: MetricDefinition }) | null {
  const normalizedTitle = normalizeMatchText(metricTitle);
  return (
    observations.find(
      (observation) =>
        normalizeMatchText(observation.metricDefinition.title) === normalizedTitle,
    ) ?? null
  );
}

export function resolveRemoveObservationTarget(
  messageText: string,
  observationId: string | null,
  observations: Array<MetricObservation & { metricDefinition: MetricDefinition }>,
  recentTurns: TelegramConversationTurn[],
  entryId: string,
): (MetricObservation & { metricDefinition: MetricDefinition }) | null {
  if (isDeicticCorrectionMessage(messageText)) {
    const lastTitle = findLastCorrectedMetricTitle(recentTurns, entryId);
    if (lastTitle) {
      const fromDialog = findObservationByMetricTitle(observations, lastTitle);
      if (fromDialog) {
        return fromDialog;
      }
    }
  }

  if (observationId) {
    const fromLlm = observations.find((observation) => observation.id === observationId);
    if (fromLlm) {
      return fromLlm;
    }
  }

  const fromMessage = findDefinitionMatchingMessageText(
    messageText,
    observations.map((observation) => observation.metricDefinition),
  );
  if (fromMessage) {
    return (
      observations.find(
        (observation) => observation.metricDefinitionId === fromMessage.id,
      ) ?? null
    );
  }

  return null;
}
