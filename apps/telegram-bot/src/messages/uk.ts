import { escapeHtml, processingStatusEmoji } from '../telegram-format.js';
import { isTelegramInlineUrlAllowed } from '../telegram-url.js';

export const MSG_START = `<b>Ласкаво просимо до Metrixify</b> 🌿

Особистий щоденник у Telegram — надішліть <b>текст</b> або <b>голосову нотатку</b>, і AI витягне метрики.

<b>Швидкий старт</b>
• Напишіть, як пройшов день
• <b>Кореляції</b> або <b>Інсайти</b> — короткий огляд у боті
• <b>Вхід у веб</b> — повний щоденник
• /language — англійська або українська

Оберіть дію нижче 👇`;

export const MSG_VOICE_ENTRY_SAVED =
  'Голосовий запис збережено та розшифровано. Відкрийте веб-додаток, щоб прочитати транскрипт.';

export const MSG_VOICE_TRANSCRIPTION_FAILED =
  'Голосове повідомлення отримано, але розшифрування не вдалося. Спробуйте ще раз або перевірте веб-додаток.';

export const MSG_HELP = `<b>Як користуватися Metrixify</b>

1️⃣ Надішліть <b>текстове повідомлення</b>, щоб створити запис
2️⃣ Надішліть <b>голосове повідомлення</b> — розшифрується автоматично
3️⃣ <b>Кореляції</b> / <b>Інсайти</b> — короткий огляд у боті
4️⃣ <b>Вхід у веб</b> (або /login) — щоденник у браузері
5️⃣ <b>Останні записи</b> (або /status) — останні записи
6️⃣ /language — перемикання мови

Скористайтеся кнопками нижче 👇`;

export const MSG_LOGIN_FAILED =
  'Не вдалося створити посилання для входу. Спробуйте ще раз або спочатку надішліть боту будь-яке текстове повідомлення.';

export function formatLoginLink(loginUrl: string): string {
  const intro = `<b>Увійти в Metrixify</b>

Натисніть кнопку нижче, щоб відкрити веб-додаток.
Посилання дійсне <b>10 хвилин</b> і працює один раз.`;

  if (isTelegramInlineUrlAllowed(loginUrl)) {
    return intro;
  }

  return `${intro}

<i>Локальний dev: Telegram не відкриває localhost. Скопіюйте посилання нижче в Chrome або Edge:</i>
<code>${escapeHtml(loginUrl)}</code>`;
}

export const MSG_PRIVATE_ONLY = 'Будь ласка, напишіть мені в приватному чаті.';

export const MSG_ENTRY_SAVED =
  'Запис збережено. Відкрийте веб-додаток, щоб переглянути щоденник: http://localhost:5173/journal';

export const MSG_ENTRY_PARTIAL_NOTE =
  'Обробка не завершилась повністю, але метрики вище вже збережені.';

export const MSG_ENTRY_NO_METRICS = 'У цьому записі метрик не знайдено.';

export const MSG_ENTRY_SAVED_HEADER = 'Запис збережено';

export const MSG_ENTRY_PROCESSING =
  '⏳ <i>Обробляю запис… Відповім тут, коли метрики будуть готові.</i>';

export const MSG_ENTRY_METRICS_HEADER = 'Метрики';

function formatObservedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 10);
  }
  return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

export function formatEntrySavedSummary(params: {
  observations: Array<{
    metricTitle: string;
    valueDisplay: string;
    observedAt: string;
  }>;
  processingStatus: string;
  journalUrl: string;
}): string {
  void params.journalUrl;

  const lines = [`<b>✓ ${escapeHtml(MSG_ENTRY_SAVED_HEADER)}</b>`, '', `<b>${escapeHtml(MSG_ENTRY_METRICS_HEADER)}</b>`];
  const sorted = [...params.observations].sort((a, b) =>
    a.metricTitle.localeCompare(b.metricTitle, 'uk'),
  );

  if (sorted.length === 0) {
    lines.push(`<i>${escapeHtml(MSG_ENTRY_NO_METRICS)}</i>`);
  } else {
    for (const observation of sorted) {
      lines.push(
        `• <b>${escapeHtml(observation.metricTitle)}</b> — ${escapeHtml(observation.valueDisplay)} <i>(${escapeHtml(formatObservedDate(observation.observedAt))})</i>`,
      );
    }
  }

  if (params.processingStatus !== 'completed') {
    lines.push('', `<i>⚠️ ${escapeHtml(MSG_ENTRY_PARTIAL_NOTE)}</i>`);
  }

  return lines.join('\n');
}

export const MSG_PROCESSING_FAILED =
  'Я отримав ваше повідомлення, але обробка не вдалася. Спробуйте ще раз або перевірте статус у веб-додатку.';

export const MSG_NO_ENTRIES =
  'Записів ще немає. Надішліть текстове повідомлення, щоб створити перший запис.';

export const MSG_LANGUAGE_PROMPT = 'Оберіть мову:';

export const MSG_LANGUAGE_UPDATED_EN = 'Language set to English.';

export const MSG_LANGUAGE_UPDATED_UK = 'Мову змінено на українську.';

export function formatStatusHeader(count: number): string {
  return `<b>Ваші останні ${count} записи</b>`;
}

export function formatStatusList(
  items: Array<{
    entryDate: string;
    processingStatus: string;
    rawText: string | null;
  }>,
): string {
  return items
    .map((entry, index) => {
      const preview = (entry.rawText ?? '').slice(0, 80).replace(/\s+/g, ' ').trim();
      const suffix = preview.length < (entry.rawText ?? '').length ? '…' : '';
      const emoji = processingStatusEmoji(entry.processingStatus);
      return `<b>${index + 1}.</b> ${escapeHtml(entry.entryDate)} ${emoji} <code>${escapeHtml(entry.processingStatus)}</code>\n${escapeHtml(preview)}${suffix}`;
    })
    .join('\n\n');
}
