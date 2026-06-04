import { GrammyError } from 'grammy';
import { describe, expect, it } from 'vitest';
import { isStaleCallbackQueryError } from './callback-query.js';

describe('isStaleCallbackQueryError', () => {
  it('detects expired callback query errors', () => {
    const error = new GrammyError(
      'Call to answerCallbackQuery failed',
      {
        ok: false,
        error_code: 400,
        description: 'Bad Request: query is too old and response timeout expired or query ID is invalid',
      },
      'answerCallbackQuery',
      {},
    );
    expect(isStaleCallbackQueryError(error)).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isStaleCallbackQueryError(new Error('network'))).toBe(false);
  });
});
