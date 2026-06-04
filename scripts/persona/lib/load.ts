import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import {
  expectedCorrelationsSchema,
  personaSpecSchema,
  type ExpectedCorrelations,
  type PersonaSpec,
} from './spec.js';
import {
  getExpectedCorrelationsPath,
  getPersonaSpecPath,
} from './paths.js';

export function loadPersonaSpec(personaId: string): PersonaSpec {
  const raw = readFileSync(getPersonaSpecPath(personaId), 'utf8');
  return personaSpecSchema.parse(parseYaml(raw));
}

export function loadExpectedCorrelations(personaId: string): ExpectedCorrelations {
  const raw = readFileSync(getExpectedCorrelationsPath(personaId), 'utf8');
  return expectedCorrelationsSchema.parse(parseYaml(raw));
}

export function assertPersonaIdMatches(spec: PersonaSpec, personaId: string): void {
  if (spec.id !== personaId) {
    throw new Error(`persona.spec.yaml id "${spec.id}" does not match folder "${personaId}"`);
  }
}

export function personaTelegramUserId(personaId: string): number {
  const hash = createHash('sha256').update(personaId).digest();
  const numeric = hash.readUInt32BE(0);
  return 900_000_010 + (numeric % 99_990);
}

export function fixtureUsername(personaId: string): string {
  return `fixture:${personaId}`;
}

export function personaIdempotencyKey(personaId: string, entryDate: string): string {
  return `persona:${personaId}:${entryDate}`;
}

export function parseDiaryFilename(filename: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})\.md$/.exec(filename);
  return match?.[1] ?? null;
}

export function entryDateFromIso(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00.000Z`);
}
