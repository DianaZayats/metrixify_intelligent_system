import type { InlineKeyboard } from 'grammy';

export const TELEGRAM_HTML_PARSE_MODE = 'HTML' as const;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '');
}

export function processingStatusEmoji(status: string): string {
  if (status === 'completed') {
    return '✅';
  }
  if (status === 'failed') {
    return '❌';
  }
  return '⏳';
}

type HtmlReplyOptions = {
  reply_markup?: InlineKeyboard;
  reply_parameters?: { message_id: number };
};

export function withHtmlReply(options?: HtmlReplyOptions) {
  return {
    parse_mode: TELEGRAM_HTML_PARSE_MODE,
    ...options,
  };
}
