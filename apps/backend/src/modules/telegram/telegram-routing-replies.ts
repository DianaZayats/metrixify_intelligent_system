import type { AppLocale, MetricObservationItem } from '@metrixify/shared-types';

function formatObservedDate(iso: string, locale: AppLocale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 10);
  }
  return date.toLocaleDateString(locale === 'uk' ? 'uk-UA' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

const CORRELATIONS_HINT_UK =
  'Якщо потрібно — оновіть кореляції на сторінці «Кореляції» у веб-щоденнику.';
const CORRELATIONS_HINT_EN =
  'If needed, refresh correlations on the Correlations page in the web journal.';

export function formatCorrectionAppliedReply(
  locale: AppLocale,
  observation: MetricObservationItem,
): string {
  const dateLabel = formatObservedDate(observation.observedAt, locale);
  if (locale === 'uk') {
    return `✓ Оновлено: ${observation.metricTitle} — ${observation.valueDisplay} (${dateLabel})\n\n${CORRELATIONS_HINT_UK}`;
  }
  return `✓ Updated: ${observation.metricTitle} — ${observation.valueDisplay} (${dateLabel})\n\n${CORRELATIONS_HINT_EN}`;
}

export function formatCorrectionObservedAtReply(
  locale: AppLocale,
  observedAtIso: string,
  count: number,
): string {
  const dateLabel = formatObservedDate(observedAtIso, locale);
  if (locale === 'uk') {
    const metricWord = count === 1 ? 'метрики' : 'метрик';
    return `✓ Оновлено дату для ${count} ${metricWord}: ${dateLabel}\n\n${CORRELATIONS_HINT_UK}`;
  }
  const metricWord = count === 1 ? 'metric' : 'metrics';
  return `✓ Updated date for ${count} ${metricWord}: ${dateLabel}\n\n${CORRELATIONS_HINT_EN}`;
}

export function formatCorrectionAddedReply(
  locale: AppLocale,
  observation: MetricObservationItem,
  created: boolean,
): string {
  const dateLabel = formatObservedDate(observation.observedAt, locale);
  if (locale === 'uk') {
    const verb = created ? 'Додано' : 'Оновлено';
    return `✓ ${verb}: ${observation.metricTitle} — ${observation.valueDisplay} (${dateLabel})\n\n${CORRELATIONS_HINT_UK}`;
  }
  const verb = created ? 'Added' : 'Updated';
  return `✓ ${verb}: ${observation.metricTitle} — ${observation.valueDisplay} (${dateLabel})\n\n${CORRELATIONS_HINT_EN}`;
}

export function formatCorrectionRemovedReply(
  locale: AppLocale,
  metricTitle: string,
): string {
  if (locale === 'uk') {
    return `✓ Прибрано: ${metricTitle}\n\n${CORRELATIONS_HINT_UK}`;
  }
  return `✓ Removed: ${metricTitle}\n\n${CORRELATIONS_HINT_EN}`;
}

export function formatCorrectionArchivedReply(
  locale: AppLocale,
  metricTitle: string,
): string {
  if (locale === 'uk') {
    return `✓ Архівовано: ${metricTitle}. Більше не відстежуватимемо цю метрику.\n\n${CORRELATIONS_HINT_UK}`;
  }
  return `✓ Archived: ${metricTitle}. We will no longer track this metric.\n\n${CORRELATIONS_HINT_EN}`;
}

export function formatCorrectionReprocessedReply(
  locale: AppLocale,
  observations: MetricObservationItem[],
): string {
  const sorted = [...observations].sort((left, right) =>
    left.metricTitle.localeCompare(right.metricTitle, locale === 'uk' ? 'uk' : 'en'),
  );
  const header =
    locale === 'uk' ? '✓ Запис перечитано. Нові метрики:' : '✓ Entry re-read. New metrics:';
  const lines = [header];

  if (sorted.length === 0) {
    lines.push(locale === 'uk' ? '• (немає метрик)' : '• (no metrics)');
  } else {
    for (const observation of sorted) {
      const dateLabel = formatObservedDate(observation.observedAt, locale);
      lines.push(
        `• ${observation.metricTitle} — ${observation.valueDisplay} (${dateLabel})`,
      );
    }
  }

  lines.push('', locale === 'uk' ? CORRELATIONS_HINT_UK : CORRELATIONS_HINT_EN);
  return lines.join('\n');
}

export function formatCorrectionUnsupportedReply(locale: AppLocale): string {
  if (locale === 'uk') {
    return 'Поки що через Telegram можна змінити значення, дату, додати, прибрати, архівувати метрику або перечитати запис. Кілька правок в одному повідомленні — скоро.';
  }
  return 'For now, Telegram can change metric values, dates, add, remove, archive, or re-read an entry. Multiple fixes in one message are coming soon.';
}

export function formatCorrectionFailedReply(locale: AppLocale): string {
  if (locale === 'uk') {
    return 'Не вдалося застосувати виправлення. Спробуйте ще раз або перевірте запис у веб-щоденнику.';
  }
  return 'Could not apply the correction. Try again or check the entry in the web journal.';
}

export function formatCorrectionNoEntryReply(locale: AppLocale): string {
  if (locale === 'uk') {
    return 'Не зрозумів, про який запис йдеться. Напишіть у контексті недавнього запису або відповідайте на повідомлення з метриками.';
  }
  return 'I could not tell which entry you mean. Refer to a recent entry or reply to the metrics message.';
}

/** @deprecated Step A stub — kept for tests if needed */
export function formatCorrectionStubReply(
  locale: AppLocale,
  entryDate: string | null,
): string {
  if (locale === 'uk') {
    if (entryDate) {
      return `✓ Зрозумів — мова про запис від ${entryDate}.\n\nАвтоматичні виправлення метрик через Telegram будуть у наступному кроці. Поки що можна переглянути запис у веб-щоденнику.`;
    }
    return '✓ Зрозумів, що ви хочете щось виправити.\n\nАвтоматичні виправлення метрик через Telegram будуть у наступному кроці. Поки що можна переглянути записи у веб-щоденнику.';
  }

  if (entryDate) {
    return `✓ Got it — you mean the entry from ${entryDate}.\n\nAutomatic metric corrections in Telegram are coming in the next step. For now, review the entry in the web journal.`;
  }
  return '✓ Got it — you want to change something.\n\nAutomatic metric corrections in Telegram are coming in the next step. For now, review entries in the web journal.';
}
