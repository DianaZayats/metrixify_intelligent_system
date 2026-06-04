/** Telegram inline `url` buttons reject localhost and non-http(s) URLs. */
export function isTelegramInlineUrlAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1';
  } catch {
    return false;
  }
}

export function webAppHint(locale: 'en' | 'uk'): string {
  return locale === 'uk' ?
      '\n\n<i>Локальний dev: кнопка «у веб» недоступна. Використайте /login або відкрийте http://localhost:5173 у браузері.</i>'
    : '\n\n<i>Local dev: web button unavailable. Use /login or open http://localhost:5173 in your browser.</i>';
}
