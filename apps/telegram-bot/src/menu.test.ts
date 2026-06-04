import { describe, expect, it } from 'vitest';
import {
  getBotCommands,
  correlationsPageKeyboard,
  insightsPageKeyboard,
  journalLinkKeyboard,
  LANGUAGE_CALLBACK,
  loginLinkKeyboard,
  MENU_CALLBACK,
  mainMenuKeyboard,
} from './menu.js';

describe('bot menu', () => {
  it('registers all slash commands in English', () => {
    const names = getBotCommands('en').map((c) => c.command);
    expect(names).toEqual([
      'start',
      'help',
      'login',
      'status',
      'correlations',
      'insights',
      'language',
    ]);
  });

  it('registers all slash commands in Ukrainian', () => {
    const names = getBotCommands('uk').map((c) => c.command);
    expect(names).toEqual([
      'start',
      'help',
      'login',
      'status',
      'correlations',
      'insights',
      'language',
    ]);
  });

  it('builds inline keyboard with menu callbacks', () => {
    const keyboard = mainMenuKeyboard('en');
    const payload = keyboard.inline_keyboard
      .flat()
      .map((button) => ('callback_data' in button ? button.callback_data : undefined));
    expect(payload).toContain(MENU_CALLBACK.status);
    expect(payload).toContain(MENU_CALLBACK.login);
    expect(payload).toContain(MENU_CALLBACK.help);
    expect(payload).toContain(MENU_CALLBACK.correlations);
    expect(payload).toContain(MENU_CALLBACK.insights);
    expect(payload).toContain('menu:language');
  });

  it('localizes inline keyboard labels', () => {
    const ukLabels = mainMenuKeyboard('uk')
      .inline_keyboard.flat()
      .map((button) => button.text);
    expect(ukLabels.some((label) => label.includes('Останні'))).toBe(true);
    expect(ukLabels.some((label) => label.includes('Кореляції'))).toBe(true);
    expect(ukLabels.some((label) => label.includes('Інсайти'))).toBe(true);
  });

  it('adds journal URL button for public URLs', () => {
    const keyboard = journalLinkKeyboard('en', 'https://app.example.com/journal');
    const urls = keyboard.inline_keyboard
      .flat()
      .map((button) => ('url' in button ? button.url : undefined));
    expect(urls).toContain('https://app.example.com/journal');
  });

  it('adds login URL button for public URLs', () => {
    const keyboard = loginLinkKeyboard('uk', 'https://app.example.com/auth/telegram-token?token=abc');
    const urls = keyboard.inline_keyboard
      .flat()
      .map((button) => ('url' in button ? button.url : undefined));
    expect(urls).toContain('https://app.example.com/auth/telegram-token?token=abc');
  });

  it('adds correlations page URL button for public URLs', () => {
    const keyboard = correlationsPageKeyboard('en', 'https://app.example.com/correlations');
    const urls = keyboard.inline_keyboard
      .flat()
      .map((button) => ('url' in button ? button.url : undefined));
    expect(urls).toContain('https://app.example.com/correlations');
  });

  it('adds insights page URL button for public URLs', () => {
    const keyboard = insightsPageKeyboard('uk', 'https://app.example.com/insights');
    const urls = keyboard.inline_keyboard
      .flat()
      .map((button) => ('url' in button ? button.url : undefined));
    expect(urls).toContain('https://app.example.com/insights');
  });

  it('defines language callback keys', () => {
    expect(LANGUAGE_CALLBACK.en).toBe('lang:en');
    expect(LANGUAGE_CALLBACK.uk).toBe('lang:uk');
  });
});
