/** Map OpenAI SDK / network failures to a stable user-facing message. */
export function normalizeOpenAiErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const status = 'status' in error ? (error as { status?: number }).status : undefined;
    if (status === 401) {
      return 'OpenAI API key rejected (401). Check OPENAI_API_KEY in .env.';
    }
    if (status === 429) {
      return 'OpenAI rate limit reached. Wait a minute and try again.';
    }
  }

  const message = error instanceof Error ? error.message : 'AI request failed';
  if (/connection error/i.test(message)) {
    return 'Temporary OpenAI network error. Wait a moment and try again.';
  }
  if (/timed?\s*out/i.test(message) || message.includes('ETIMEDOUT')) {
    return 'OpenAI request timed out. Try again or check VPN/firewall.';
  }
  return message;
}

export function isRetryableOpenAiError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return /connection error/i.test(error.message) || /timed?\s*out/i.test(error.message);
}
