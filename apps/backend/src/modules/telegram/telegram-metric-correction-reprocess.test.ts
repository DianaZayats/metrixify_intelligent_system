import { describe, expect, it } from 'vitest';
import { isReprocessCorrectionMessage } from './telegram-metric-correction-reprocess.js';

describe('telegram-metric-correction-reprocess', () => {
  it('detects explicit reprocess phrases', () => {
    expect(isReprocessCorrectionMessage('перечитай запись, там два дня')).toBe(true);
    expect(isReprocessCorrectionMessage('re-read this entry')).toBe(true);
  });

  it('detects indirect reprocess phrases', () => {
    expect(
      isReprocessCorrectionMessage(
        'Кажется, метрики не те — посмотри ещё раз, там на самом деле два дня',
      ),
    ).toBe(true);
    expect(
      isReprocessCorrectionMessage('Ты не всё правильно извлёк из этого текста, пересмотри запись'),
    ).toBe(true);
    expect(isReprocessCorrectionMessage('извлеки метрики заново')).toBe(true);
  });

  it('does not match ordinary value corrections', () => {
    expect(isReprocessCorrectionMessage('на самом деле 2 минуты')).toBe(false);
    expect(isReprocessCorrectionMessage('убери эту метрику')).toBe(false);
  });
});
