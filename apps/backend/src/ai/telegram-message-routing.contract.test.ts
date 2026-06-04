import { describe, expect, it } from 'vitest';
import { zodResponseFormat } from 'openai/helpers/zod';
import { loadTelegramMessageRoutingPrompt } from './prompt-loader.js';
import { telegramMessageRoutingAiOutputSchema } from '../modules/telegram/telegram-message-routing.schemas.js';

describe('telegram-message-routing prompt contract', () => {
  it('builds OpenAI-compatible JSON schema for structured output', () => {
    const format = zodResponseFormat(
      telegramMessageRoutingAiOutputSchema,
      'telegram_message_routing',
    );
    expect(format.type).toBe('json_schema');
    expect(format.json_schema?.name).toBe('telegram_message_routing');
    expect(format.json_schema?.strict).toBe(true);
  });

  it('loads prompt version from frontmatter', () => {
    const prompt = loadTelegramMessageRoutingPrompt();
    expect(prompt.version).toBe('1.0.0');
    expect(prompt.body).toContain('diary_entry');
    expect(prompt.body).toContain('correction');
  });
});
