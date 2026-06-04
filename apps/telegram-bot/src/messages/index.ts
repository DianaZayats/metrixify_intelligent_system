import type { AppLocale } from '@metrixify/shared-types';
import * as en from './en.js';
import * as uk from './uk.js';

export type BotMessages = {
  MSG_START: string;
  MSG_VOICE_ENTRY_SAVED: string;
  MSG_VOICE_TRANSCRIPTION_FAILED: string;
  MSG_HELP: string;
  MSG_LOGIN_FAILED: string;
  MSG_PRIVATE_ONLY: string;
  MSG_ENTRY_SAVED: string;
  MSG_ENTRY_PROCESSING: string;
  MSG_PROCESSING_FAILED: string;
  MSG_NO_ENTRIES: string;
  MSG_LANGUAGE_PROMPT: string;
  MSG_LANGUAGE_UPDATED_EN: string;
  MSG_LANGUAGE_UPDATED_UK: string;
  formatLoginLink: (loginUrl: string) => string;
  formatStatusHeader: (count: number) => string;
  formatStatusList: (
    items: Array<{
      entryDate: string;
      processingStatus: string;
      rawText: string | null;
    }>,
  ) => string;
  formatEntrySavedSummary: (params: {
    observations: Array<{
      metricTitle: string;
      valueDisplay: string;
      observedAt: string;
    }>;
    processingStatus: string;
    journalUrl: string;
  }) => string;
};

const locales: Record<AppLocale, BotMessages> = {
  en,
  uk,
};

export function getMessages(locale: AppLocale): BotMessages {
  return locales[locale] ?? locales.en;
}
