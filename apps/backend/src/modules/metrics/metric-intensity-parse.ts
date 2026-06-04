/**
 * Generic relative intensity phrases → ordinal scale fraction.
 * Metric-agnostic: works for any ordinal candidate when evidence/clause carries intensity language.
 */

export type IntensityLevel = 'very_low' | 'low' | 'mid' | 'high' | 'very_high';

type IntensityRule = {
  pattern: RegExp;
  level: IntensityLevel;
  /** When set, rule applies only if negation is absent in the match window. */
  requiresNoNegation?: boolean;
};

/** Ordered most specific → general. First match wins. */
const INTENSITY_RULES: IntensityRule[] = [
  {
    pattern:
      /(?:дуже|very|extremely|strongly|значно|сильно)\s+(?:висок|high|сильн|strong|інтенсив)/i,
    level: 'very_high',
  },
  {
    pattern:
      /(?:висок(?:ий|а|і|е)|high|сильн(?:ий|а|е)|strong|інтенсивн(?:ий|а|і|е))(?:\s|$|[,.])/i,
    level: 'high',
    requiresNoNegation: true,
  },
  {
    pattern:
      /(?:вищ(?:ий|е|а|і)|above|higher\s+than)\s+(?:за\s+)?(?:середн|average|normal|звичайн)/i,
    level: 'high',
  },
  {
    pattern:
      /(?:нижч(?:ий|е|а|і)|below|lower\s+than)\s+(?:за\s+)?(?:середн|average|normal|звичайн)/i,
    level: 'low',
  },
  {
    pattern: /(?:помірн(?:ий|а|і|е)|moderate|умеренн)/i,
    level: 'mid',
  },
  {
    pattern: /(?:середн(?:ий|я|є)|average|normal|нормальн(?:ий|а|і|е)|typical)/i,
    level: 'mid',
    requiresNoNegation: true,
  },
  {
    pattern: /(?:рівн(?:ий|а|е)|steady|stable|even)(?:\s|$|[,.])/i,
    level: 'mid',
  },
  {
    pattern: /без\s+сильн(?:ої|ой|ого)\s+тривож/i,
    level: 'very_low',
  },
  {
    pattern: /(?:low|without\s+strong)\s+anxiety/i,
    level: 'very_low',
  },
  {
    pattern: /(?:спокійн(?:ий|іше|ше|а)|calm|quiet)/i,
    level: 'low',
  },
  {
    pattern: /(?:низьк(?:ий|а|і|е)|low|слабк(?:ий|а|і|е)|weak)(?:\s|$|[,.])/i,
    level: 'low',
    requiresNoNegation: true,
  },
  {
    pattern: /(?:дуже|very|extremely)\s+(?:низьк|low|слабк|weak)/i,
    level: 'very_low',
  },
];

const NEGATION_NEAR =
  /\b(?:не|not|no|without|без|немає|нема)\s+(?:дуже\s+)?(?:висок|high|сильн|strong|низьк|low)/i;

const LEVEL_FRACTION: Record<IntensityLevel, number> = {
  very_low: 0.12,
  low: 0.25,
  mid: 0.5,
  high: 0.78,
  very_high: 0.92,
};

export function spanFraction(scaleMin: number, scaleMax: number, fraction: number): number {
  const span = scaleMax - scaleMin;
  if (span <= 0) {
    return scaleMin;
  }
  return Math.round(scaleMin + span * fraction);
}

export function detectIntensityLevel(text: string): IntensityLevel | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  for (const rule of INTENSITY_RULES) {
    const match = rule.pattern.exec(trimmed);
    if (!match) {
      continue;
    }
    if (rule.requiresNoNegation) {
      const windowStart = Math.max(0, match.index - 12);
      const window = trimmed.slice(windowStart, match.index + match[0].length + 8);
      if (NEGATION_NEAR.test(window)) {
        continue;
      }
    }
    return rule.level;
  }

  return null;
}

/** Map detected intensity to a value on the candidate's ordinal scale. */
export function intensityLevelToOrdinalValue(
  level: IntensityLevel,
  scaleMin: number,
  scaleMax: number,
): number {
  return spanFraction(scaleMin, scaleMax, LEVEL_FRACTION[level]);
}

/**
 * When evidence/clause uses relative intensity language (high, above average, calm…),
 * infer ordinal value on the metric's scale — without knowing candidate_key.
 */
export function applyGenericIntensityToOrdinal<T extends {
  value_type: string;
  value_number: number | null;
  scale_min: number | null;
  scale_max: number | null;
  evidence_text: string;
  confidence: number;
}>(candidate: T, scopes: string[]): T | null {
  if (candidate.value_type !== 'ordinal') {
    return null;
  }

  for (const scope of scopes) {
    const level = detectIntensityLevel(scope);
    if (!level) {
      continue;
    }

    const targetMin = candidate.scale_min ?? 1;
    const targetMax = candidate.scale_max ?? 5;
    return {
      ...candidate,
      value_number: intensityLevelToOrdinalValue(level, targetMin, targetMax),
      scale_min: targetMin,
      scale_max: targetMax,
      confidence: Math.max(candidate.confidence, 0.88),
    };
  }

  return null;
}
