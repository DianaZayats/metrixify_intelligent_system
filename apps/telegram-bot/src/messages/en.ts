import { escapeHtml, processingStatusEmoji } from '../telegram-format.js';
import { isTelegramInlineUrlAllowed } from '../telegram-url.js';

export const MSG_START = `<b>Welcome to Metrixify</b> 🌿

Your personal diary in Telegram — send <b>text</b> or a <b>voice note</b> and AI will extract metrics for you.

<b>Quick start</b>
• Write how your day went
• Tap <b>Correlations</b> or <b>Insights</b> for a quick snapshot
• Tap <b>Web sign-in</b> to open the full journal
• /language — English or Ukrainian

Choose an action below 👇`;

export const MSG_VOICE_ENTRY_SAVED =
  'Voice entry saved and transcribed. Open the web app to read the transcript.';

export const MSG_VOICE_TRANSCRIPTION_FAILED =
  'Voice message received, but transcription failed. You can try again or check the web app.';

export const MSG_HELP = `<b>How to use Metrixify</b>

1️⃣ Send a <b>text message</b> to log an entry
2️⃣ Send a <b>voice message</b> — transcribed automatically
3️⃣ <b>Correlations</b> / <b>Insights</b> — quick snapshot in Telegram
4️⃣ <b>Web sign-in</b> (or /login) — open the journal in your browser
5️⃣ <b>Recent entries</b> (or /status) — last diary entries
6️⃣ /language — switch between English and Ukrainian

Use the buttons below for quick actions 👇`;

export const MSG_LOGIN_FAILED =
  'Could not create a login link. Try again in a moment or message the bot first with any text.';

export function formatLoginLink(loginUrl: string): string {
  const intro = `<b>Sign in to Metrixify</b>

Tap the button below to open the web app.
The link expires in <b>10 minutes</b> and works once.`;

  if (isTelegramInlineUrlAllowed(loginUrl)) {
    return intro;
  }

  return `${intro}

<i>Local dev: Telegram cannot open localhost links. Copy the URL below into Chrome or Edge:</i>
<code>${escapeHtml(loginUrl)}</code>`;
}

export const MSG_PRIVATE_ONLY = 'Please message me in a private chat.';

export const MSG_ENTRY_SAVED =
  'Entry saved. Open the web app to view your journal: http://localhost:5173/journal';

export const MSG_ENTRY_PARTIAL_NOTE =
  'Processing did not fully finish, but any metrics above are already saved.';

export const MSG_ENTRY_NO_METRICS = 'No metrics found in this entry.';

export const MSG_ENTRY_SAVED_HEADER = 'Entry saved';

export const MSG_ENTRY_PROCESSING =
  '⏳ <i>Processing your entry… I will reply here when metrics are ready.</i>';

export const MSG_ENTRY_METRICS_HEADER = 'Metrics';

function formatObservedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 10);
  }
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
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
    a.metricTitle.localeCompare(b.metricTitle),
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
  'I received your message, but processing failed. You can try again or check the web app status page.';

export const MSG_NO_ENTRIES = 'No entries yet. Send a text message to create your first entry.';

export const MSG_LANGUAGE_PROMPT = 'Choose your language:';

export const MSG_LANGUAGE_UPDATED_EN = 'Language set to English.';

export const MSG_LANGUAGE_UPDATED_UK = 'Мову змінено на українську.';

export function formatStatusHeader(count: number): string {
  return `<b>Your last ${count} entries</b>`;
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
