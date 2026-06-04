import { describe, expect, it } from 'vitest';
import { jsonContextPackToToon } from './index.js';

describe('jsonContextPackToToon', () => {
  it('encodes a compact list of metric definitions', () => {
    const toon = jsonContextPackToToon({
      metrics: [
        { key: 'wellbeing', title: 'Wellbeing', value_type: 'ordinal' },
        { key: 'sleep_hours', title: 'Sleep hours', value_type: 'number' },
      ],
    });
    expect(toon).toContain('wellbeing');
    expect(toon.length).toBeGreaterThan(0);
  });
});
