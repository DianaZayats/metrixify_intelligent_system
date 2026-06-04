import { parseEntryDateFromText } from './entry-date.js';

export function entryTextForDateParse(
  rawText: string | null | undefined,
  transcriptText: string | null | undefined,
): string {
  return (rawText ?? transcriptText ?? '').trim();
}

export function observedAtForEntryDate(entryDate: Date): Date {
  return new Date(`${entryDate.toISOString().slice(0, 10)}T12:00:00.000Z`);
}

export function parsedEntryDateFromEntryText(
  rawText: string | null | undefined,
  transcriptText: string | null | undefined,
): Date | null {
  return parseEntryDateFromText(entryTextForDateParse(rawText, transcriptText));
}
