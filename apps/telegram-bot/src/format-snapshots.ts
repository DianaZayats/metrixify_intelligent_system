import type {
  AppLocale,
  TelegramCorrelationsSnapshotResponse,
  TelegramInsightsSnapshotResponse,
} from '@metrixify/shared-types';
import { escapeHtml } from './telegram-format.js';

function formatCorrelationValue(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}`;
}

function formatLagLabel(lag: number): string {
  return lag > 0 ? `+${lag}` : String(lag);
}

function confidenceEmoji(confidence: string): string {
  if (confidence === 'high') {
    return '✅';
  }
  if (confidence === 'medium') {
    return '⚠️';
  }
  return '🔬';
}

function formatGeneratedDate(iso: string, locale: AppLocale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 10);
  }
  return date.toLocaleDateString(locale === 'uk' ? 'uk-UA' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatCorrelationsSnapshot(
  locale: AppLocale,
  data: TelegramCorrelationsSnapshotResponse,
): string {
  if (data.total === 0) {
    return locale === 'uk'
      ? '<b>Кореляції</b>\n\n<i>Поки немає даних. Додайте записи в щоденник і запустіть аналіз у веб-додатку.</i>'
      : '<b>Correlations</b>\n\n<i>No data yet. Add diary entries and run analysis in the web app.</i>';
  }

  const header =
    locale === 'uk'
      ? `<b>Топ кореляції</b> <i>(${data.items.length} з ${data.total})</i>`
      : `<b>Top correlations</b> <i>(${data.items.length} of ${data.total})</i>`;

  const lines = [header, ''];

  data.items.forEach((item, index) => {
    const exploratory =
      item.exploratory ?
        locale === 'uk' ?
          ' · 🔬 дослідницька'
        : ' · 🔬 exploratory'
      : '';
    lines.push(
      `<b>${index + 1}.</b> ${escapeHtml(item.metricATitle)} · ${escapeHtml(item.metricBTitle)}`,
      `   r ${formatCorrelationValue(item.correlationValue)} · lag ${formatLagLabel(item.lagDays)} · n=${item.sampleSize}${exploratory}`,
    );
  });

  lines.push(
    '',
    locale === 'uk' ?
      '<i>Кореляція ≠ причинність. Деталі — у веб-додатку.</i>'
    : '<i>Correlation ≠ causation. See the web app for details.</i>',
  );

  return lines.join('\n');
}

export function formatInsightsSnapshot(
  locale: AppLocale,
  data: TelegramInsightsSnapshotResponse,
): string {
  if (!data.report) {
    return locale === 'uk' ?
        '<b>Інсайти</b>\n\n<i>Звітів ще немає. Згенеруйте інсайти на сторінці Insights у веб-додатку.</i>'
      : '<b>Insights</b>\n\n<i>No reports yet. Generate insights on the Insights page in the web app.</i>';
  }

  const { report } = data;
  const header =
    locale === 'uk' ?
      `<b>Останні інсайти</b> <i>(${formatGeneratedDate(report.generatedAt, locale)})</i>`
    : `<b>Latest insights</b> <i>(${formatGeneratedDate(report.generatedAt, locale)})</i>`;

  const lines = [header, ''];

  if (report.insights.length > 0) {
    lines.push(locale === 'uk' ? '<b>Інсайти</b>' : '<b>Insights</b>');
    for (const insight of report.insights) {
      lines.push(
        `${confidenceEmoji(insight.confidence)} <b>${escapeHtml(insight.title)}</b>`,
        `${escapeHtml(insight.body)}`,
        '',
      );
    }
  }

  if (report.recommendations.length > 0) {
    lines.push(locale === 'uk' ? '<b>Рекомендації</b>' : '<b>Recommendations</b>');
    for (const item of report.recommendations) {
      lines.push(`• <b>${escapeHtml(item.title)}</b> — ${escapeHtml(item.body)}`);
    }
  }

  return lines.join('\n').trim();
}
