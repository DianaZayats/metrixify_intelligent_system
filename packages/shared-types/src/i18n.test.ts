import { describe, expect, it } from 'vitest';
import { resolveLocalized, resolveTagLabel } from './i18n.js';

describe('i18n helpers', () => {
  it('resolveLocalized prefers uk when locale is uk', () => {
    expect(resolveLocalized({ en: 'Wellbeing', uk: 'Самопочуття' }, 'uk', 'fallback')).toBe(
      'Самопочуття',
    );
  });

  it('resolveLocalized falls back to en when uk missing', () => {
    expect(resolveLocalized({ en: 'Wellbeing' }, 'uk', 'legacy')).toBe('Wellbeing');
  });

  it('resolveLocalized uses fallback for null value', () => {
    expect(resolveLocalized(null, 'uk', 'legacy title')).toBe('legacy title');
  });

  it('resolveTagLabel uses tags map then slug', () => {
    const tags = { sleep: { en: 'Sleep', uk: 'Сон' } };
    expect(resolveTagLabel('sleep', tags, 'uk')).toBe('Сон');
    expect(resolveTagLabel('unknown', tags, 'uk')).toBe('unknown');
  });
});
