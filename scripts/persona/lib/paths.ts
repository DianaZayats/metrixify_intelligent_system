import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../../..');

export function getRepoRoot(): string {
  return repoRoot;
}

export function getPersonaDir(personaId: string): string {
  return resolve(repoRoot, 'fixtures', 'personas', personaId);
}

export function getPersonaSpecPath(personaId: string): string {
  return resolve(getPersonaDir(personaId), 'persona.spec.yaml');
}

export function getPersonaDiaryDir(personaId: string): string {
  return resolve(getPersonaDir(personaId), 'diary');
}

export function getExpectedCorrelationsPath(personaId: string): string {
  return resolve(getPersonaDir(personaId), 'expected', 'correlations.yaml');
}

export function getExpectedInsightsPath(personaId: string): string {
  return resolve(getPersonaDir(personaId), 'expected', 'insights.yaml');
}
