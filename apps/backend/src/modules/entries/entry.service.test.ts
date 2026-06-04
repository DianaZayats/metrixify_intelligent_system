import { describe, expect, it } from 'vitest';
import { buildTelegramIdempotencyKey } from './entry.service.js';

describe('buildTelegramIdempotencyKey', () => {
  it('prefixes update id', () => {
    expect(buildTelegramIdempotencyKey(42)).toBe('telegram:42');
  });
});
