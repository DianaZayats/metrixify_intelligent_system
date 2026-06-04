import { describe, expect, it } from 'vitest';
import {
  inferObservedDateFromCorrection,
  isDateOnlyCorrectionMessage,
  shiftEntryDateYmd,
} from './telegram-metric-correction-date.js';

describe('telegram-metric-correction-date', () => {
  it('detects today-not-yesterday corrections', () => {
    expect(isDateOnlyCorrectionMessage('А хотя нет, это было сегодня, а не вчера')).toBe(true);
    expect(isDateOnlyCorrectionMessage('это было сегодня, а не вчера')).toBe(true);
  });

  it('infers entry date when user moves events to today', () => {
    expect(
      inferObservedDateFromCorrection(
        'А хотя нет, это было сегодня, а не вчера',
        '2026-06-01',
      ),
    ).toBe('2026-06-01');
  });

  it('infers previous day when user moves events to yesterday', () => {
    expect(
      inferObservedDateFromCorrection(
        'на самом деле это было вчера, а не сегодня',
        '2026-06-01',
      ),
    ).toBe('2026-05-31');
  });

  it('shifts entry dates by day delta', () => {
    expect(shiftEntryDateYmd('2026-06-01', -1)).toBe('2026-05-31');
  });
});
