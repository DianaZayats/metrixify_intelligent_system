import { describe, expect, it } from 'vitest';
import { zodResponseFormat } from 'openai/helpers/zod';
import { loadTelegramMetricCorrectionPrompt } from './prompt-loader.js';
import { telegramMetricCorrectionAiOutputSchema } from '../modules/telegram/telegram-metric-correction.schemas.js';

describe('telegram-metric-correction prompt contract', () => {
  it('builds OpenAI-compatible JSON schema for structured output', () => {
    const format = zodResponseFormat(
      telegramMetricCorrectionAiOutputSchema,
      'telegram_metric_correction',
    );
    expect(format.type).toBe('json_schema');
    expect(format.json_schema?.name).toBe('telegram_metric_correction');
  });

  it('loads prompt version from frontmatter', () => {
    const prompt = loadTelegramMetricCorrectionPrompt();
    expect(prompt.version).toBe('1.5.0');
    expect(prompt.body).toContain('fix_value');
    expect(prompt.body).toContain('fix_observed_at');
    expect(prompt.body).toContain('add_observation');
    expect(prompt.body).toContain('remove_observation');
    expect(prompt.body).toContain('archive_metric');
    expect(prompt.body).toContain('reprocess_entry');
  });
});
