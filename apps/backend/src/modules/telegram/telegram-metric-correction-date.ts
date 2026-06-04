const CROSS_DAY_BEFORE_BOUNDARY = /[\s,.!?;:(«"'"\[]/;
const CROSS_DAY_AFTER_BOUNDARY = /[\s,.!?;:)"»"'"\]]/;

const TODAY_WORDS = ['сегодня', 'today'] as const;
const YESTERDAY_WORDS = ['вчера', 'вчора', 'yesterday'] as const;

function hasPhrase(text: string, phrase: string): boolean {
  const lower = text.toLowerCase();
  let fromIndex = 0;
  while (fromIndex < lower.length) {
    const index = lower.indexOf(phrase, fromIndex);
    if (index === -1) {
      return false;
    }
    const beforeOk = index === 0 || CROSS_DAY_BEFORE_BOUNDARY.test(lower[index - 1]!);
    const afterIndex = index + phrase.length;
    const afterOk =
      afterIndex >= lower.length || CROSS_DAY_AFTER_BOUNDARY.test(lower[afterIndex]!);
    if (beforeOk && afterOk) {
      return true;
    }
    fromIndex = index + 1;
  }
  return false;
}

function hasAnyPhrase(text: string, phrases: readonly string[]): boolean {
  return phrases.some((phrase) => hasPhrase(text, phrase));
}

function hasNegatedYesterday(text: string): boolean {
  return (
    hasPhrase(text, 'не вчера') ||
    hasPhrase(text, 'не вчора') ||
    hasPhrase(text, 'not yesterday') ||
    hasPhrase(text, 'а не вчера') ||
    hasPhrase(text, 'а не вчора')
  );
}

function hasNegatedToday(text: string): boolean {
  return (
    hasPhrase(text, 'не сегодня') ||
    hasPhrase(text, 'not today') ||
    hasPhrase(text, 'а не сегодня')
  );
}

export function shiftEntryDateYmd(entryDate: string, dayDelta: number): string {
  const date = new Date(`${entryDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + dayDelta);
  return date.toISOString().slice(0, 10);
}

/** User message primarily corrects calendar day, not a metric value. */
export function isDateOnlyCorrectionMessage(messageText: string): boolean {
  const text = messageText.trim();
  if (!text) {
    return false;
  }

  const saysToday = hasAnyPhrase(text, TODAY_WORDS);
  const saysYesterday = hasAnyPhrase(text, YESTERDAY_WORDS);
  const negatesYesterday = hasNegatedYesterday(text);
  const negatesToday = hasNegatedToday(text);

  return (
    (saysToday && negatesYesterday) ||
    (saysYesterday && negatesToday) ||
    (negatesYesterday && saysToday) ||
    (negatesToday && saysYesterday)
  );
}

export function inferObservedDateFromCorrection(
  messageText: string,
  entryDate: string,
): string | null {
  const text = messageText.trim();
  if (!text) {
    return null;
  }

  const saysToday = hasAnyPhrase(text, TODAY_WORDS);
  const saysYesterday = hasAnyPhrase(text, YESTERDAY_WORDS);
  const negatesYesterday = hasNegatedYesterday(text);
  const negatesToday = hasNegatedToday(text);

  if (negatesYesterday && saysToday) {
    return entryDate;
  }

  if (negatesToday && saysYesterday) {
    return shiftEntryDateYmd(entryDate, -1);
  }

  if (saysToday && negatesYesterday) {
    return entryDate;
  }

  if (saysYesterday && negatesToday) {
    return shiftEntryDateYmd(entryDate, -1);
  }

  if (negatesYesterday && !negatesToday) {
    return entryDate;
  }

  if (negatesToday && !negatesYesterday) {
    return shiftEntryDateYmd(entryDate, -1);
  }

  return null;
}
