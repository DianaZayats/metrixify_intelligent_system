import { describe, expect, it } from 'vitest';
import { isTelegramInlineUrlAllowed } from './telegram-url.js';
import { correlationsPageKeyboard } from './menu.js';

describe('isTelegramInlineUrlAllowed', () => {
  it('rejects localhost URLs', () => {
    expect(isTelegramInlineUrlAllowed('http://localhost:5173/correlations')).toBe(false);
    expect(isTelegramInlineUrlAllowed('http://127.0.0.1:5173/insights')).toBe(false);
  });

  it('accepts public https URLs', () => {
    expect(isTelegramInlineUrlAllowed('https://app.metrixify.example/correlations')).toBe(true);
  });
});

describe('correlationsPageKeyboard', () => {
  it('omits url button for localhost', () => {
    const keyboard = correlationsPageKeyboard('en', 'http://localhost:5173/correlations');
    const urls = keyboard.inline_keyboard
      .flat()
      .map((button) => ('url' in button ? button.url : undefined))
      .filter(Boolean);
    expect(urls).toEqual([]);
  });

  it('includes url button for public URLs', () => {
    const keyboard = correlationsPageKeyboard('en', 'https://app.example.com/correlations');
    const urls = keyboard.inline_keyboard
      .flat()
      .map((button) => ('url' in button ? button.url : undefined));
    expect(urls).toContain('https://app.example.com/correlations');
  });
});
