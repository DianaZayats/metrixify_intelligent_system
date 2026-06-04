import { describe, expect, it } from 'vitest';
import { isRetryableOpenAiError, normalizeOpenAiErrorMessage } from './openai-error.js';

describe('normalizeOpenAiErrorMessage', () => {
  it('maps OpenAI connection errors', () => {
    expect(normalizeOpenAiErrorMessage(new Error('Connection error.'))).toContain(
      'Temporary OpenAI network error',
    );
  });

  it('passes through other messages', () => {
    expect(normalizeOpenAiErrorMessage(new Error('Invalid schema'))).toBe('Invalid schema');
  });
});

describe('isRetryableOpenAiError', () => {
  it('detects connection errors', () => {
    expect(isRetryableOpenAiError(new Error('Connection error.'))).toBe(true);
  });
});
