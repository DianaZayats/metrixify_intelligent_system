/** Returns UTC midnight for "today" in the given IANA timezone (fallback: UTC). */
export function entryDateForTimezone(timezone: string, now = new Date()): Date {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;

    if (year && month && day) {
      return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    }
  } catch {
    // invalid timezone — fall through
  }

  const utc = new Date(now);
  utc.setUTCHours(0, 0, 0, 0);
  return utc;
}

/** Parse calendar date from diary header e.g. "День 25 (2026-03-25):" or inline YYYY-MM-DD. */
export function parseEntryDateFromText(text: string): Date | null {
  const match = text.match(/\((\d{4}-\d{2}-\d{2})\)/) ?? text.match(/(?:^|\s)(\d{4}-\d{2}-\d{2})(?:[)\s,:]|$)/);
  const iso = match?.[1];
  if (!iso) {
    return null;
  }
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
