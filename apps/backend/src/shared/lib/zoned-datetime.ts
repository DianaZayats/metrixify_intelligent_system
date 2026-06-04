/** Build a UTC instant for a wall-clock time on a calendar date in an IANA timezone. */
export function dateAtLocalTime(
  dateYmd: string,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const [yearRaw, monthRaw, dayRaw] = dateYmd.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return new Date(`${dateYmd}T12:00:00.000Z`);
  }

  try {
    const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const asUtc = new Date(utcGuess.toLocaleString('en-US', { timeZone: 'UTC' }));
    const asLocal = new Date(utcGuess.toLocaleString('en-US', { timeZone }));
    const offsetMs = asUtc.getTime() - asLocal.getTime();
    return new Date(utcGuess.getTime() + offsetMs);
  } catch {
    return new Date(`${dateYmd}T12:00:00.000Z`);
  }
}
