import { existsSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getIntroImageInputFile, INTRO_IMAGE_PATH } from './brand-assets.js';

const TELEGRAM_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

describe('brand assets', () => {
  it('resolves compressed intro image for Telegram', () => {
    expect(INTRO_IMAGE_PATH).toContain('intro-start.jpg');
    expect(existsSync(INTRO_IMAGE_PATH)).toBe(true);
    expect(getIntroImageInputFile()).toBeDefined();
  });

  it('stays under Telegram sendPhoto size limit', () => {
    expect(statSync(INTRO_IMAGE_PATH).size).toBeLessThan(TELEGRAM_PHOTO_MAX_BYTES);
  });
});
