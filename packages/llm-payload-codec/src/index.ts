import { encode } from '@toon-format/toon';

export const CODEC_VERSION = '1';

/**
 * Converts a JSON context pack into TOON for LLM input.
 * JSON remains the source of truth everywhere else.
 */
export function jsonContextPackToToon(contextPack: unknown): string {
  return encode(contextPack);
}
