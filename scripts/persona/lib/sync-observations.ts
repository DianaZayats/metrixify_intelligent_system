import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { prisma } from '../../../apps/backend/src/shared/db/prisma.js';
import { entryDateFromIso, personaIdempotencyKey } from './load.js';
import { getPersonaDiaryDir } from './paths.js';
import type { PersonaSpec } from './spec.js';

const manifestSchema = z.object({
  personaId: z.string(),
  days: z.array(
    z.object({
      date: z.string(),
      text: z.string(),
      signals: z.record(z.string(), z.boolean()),
    }),
  ),
});

export function loadPersonaManifest(personaId: string) {
  const raw = readFileSync(resolve(getPersonaDiaryDir(personaId), 'manifest.json'), 'utf8');
  return manifestSchema.parse(JSON.parse(raw));
}

export async function syncPersonaObservationsFromManifest(params: {
  personaId: string;
  userId: string;
  spec: PersonaSpec;
}): Promise<number> {
  const manifest = loadPersonaManifest(params.personaId);
  let synced = 0;

  for (const day of manifest.days) {
    const idempotencyKey = personaIdempotencyKey(params.personaId, day.date);
    const source = await prisma.entrySource.findUnique({
      where: { idempotencyKey },
      include: { entry: true },
    });
    if (!source?.entry) {
      continue;
    }

    for (const metric of params.spec.metrics) {
      const signal = day.signals[metric.key];
      if (signal === undefined) {
        continue;
      }

      const definition = await prisma.metricDefinition.findUnique({
        where: { userId_key: { userId: params.userId, key: metric.key } },
      });
      if (!definition) {
        continue;
      }

      const observedAt = entryDateFromIso(day.date);
      const existing = await prisma.metricObservation.findFirst({
        where: {
          userId: params.userId,
          entryId: source.entry.id,
          metricDefinitionId: definition.id,
        },
      });

      if (existing) {
        await prisma.metricObservation.update({
          where: { id: existing.id },
          data: {
            observedAt,
            valueBoolean: signal,
            valueNumber: null,
            evidenceText: 'persona fixture ground truth',
          },
        });
      } else {
        await prisma.metricObservation.create({
          data: {
            userId: params.userId,
            entryId: source.entry.id,
            metricDefinitionId: definition.id,
            observedAt,
            valueBoolean: signal,
            valueNumber: null,
            confidence: 1,
            evidenceText: 'persona fixture ground truth',
            source: 'system',
          },
        });
      }
      synced += 1;
    }
  }

  return synced;
}
