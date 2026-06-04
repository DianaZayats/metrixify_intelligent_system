import { GrammyError, type Context } from 'grammy';

export function isStaleCallbackQueryError(error: unknown): boolean {
  return (
    error instanceof GrammyError &&
    error.error_code === 400 &&
    error.description.includes('query is too old')
  );
}

/** Telegram rejects callback answers after restart or long delays — do not crash the bot. */
export async function safeAnswerCallbackQuery(ctx: Context): Promise<void> {
  try {
    await ctx.answerCallbackQuery();
  } catch (error) {
    if (isStaleCallbackQueryError(error)) {
      console.warn('[telegram-bot] Ignoring stale callback query after restart or timeout');
      return;
    }
    throw error;
  }
}
