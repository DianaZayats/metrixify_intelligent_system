import { describe, expect, it } from 'vitest';
import { escapeHtml, processingStatusEmoji, stripHtml } from './telegram-format.js';

describe('telegram-format', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml('a & b <c>')).toBe('a &amp; b &lt;c&gt;');
  });

  it('strips HTML tags for plain storage', () => {
    expect(stripHtml('<b>Hello</b> world')).toBe('Hello world');
  });

  it('maps processing status to emoji', () => {
    expect(processingStatusEmoji('completed')).toBe('✅');
    expect(processingStatusEmoji('failed')).toBe('❌');
    expect(processingStatusEmoji('summarizing')).toBe('⏳');
  });
});
