import type { Prisma, User } from '@prisma/client';
import { prisma } from '../../../apps/backend/src/shared/db/prisma.js';
import { upsertUserFromTelegram } from '../../../apps/backend/src/modules/users/user.repository.js';
import type { PersonaMetric, PersonaSpec } from './spec.js';
import { fixtureUsername, personaTelegramUserId } from './load.js';

export async function ensurePersonaUser(spec: PersonaSpec): Promise<User> {
  const telegramUserId = BigInt(personaTelegramUserId(spec.id));
  const user = await upsertUserFromTelegram({
    telegramUserId,
    username: fixtureUsername(spec.id),
    firstName: 'Persona',
    lastName: spec.id,
    languageCode: spec.locale,
  });

  if (user.locale !== spec.locale || user.timezone !== spec.timezone) {
    return prisma.user.update({
      where: { id: user.id },
      data: {
        locale: spec.locale,
        timezone: spec.timezone,
      },
    });
  }

  return user;
}

export async function resetPersonaUserData(userId: string): Promise<void> {
  await prisma.correlationResult.deleteMany({ where: { userId } });
  await prisma.metricObservation.deleteMany({ where: { userId } });
  await prisma.metricDefinition.deleteMany({ where: { userId } });
  await prisma.profileFactEvidence.deleteMany({
    where: { profileFact: { userId } },
  });
  await prisma.profileFact.deleteMany({ where: { userId } });
  await prisma.aiRun.deleteMany({ where: { userId } });
  await prisma.entrySource.deleteMany({ where: { userId } });
  await prisma.diaryEntry.deleteMany({ where: { userId } });
}

export async function seedPersonaMetricDefinitions(
  userId: string,
  metrics: PersonaMetric[],
): Promise<void> {
  for (const metric of metrics) {
    const titleI18n: Prisma.InputJsonValue = {
      en: metric.title_i18n?.en ?? metric.title,
      uk: metric.title_i18n?.uk ?? metric.title,
    };

    await prisma.metricDefinition.upsert({
      where: {
        userId_key: {
          userId,
          key: metric.key,
        },
      },
      create: {
        userId,
        key: metric.key,
        title: metric.title,
        titleI18n,
        valueType: metric.value_type,
        status: 'active',
        createdBy: 'system',
        aliasesJson: [metric.title, ...(metric.title_i18n?.uk ? [metric.title_i18n.uk] : [])],
      },
      update: {
        title: metric.title,
        titleI18n,
        valueType: metric.value_type,
        status: 'active',
        aliasesJson: [metric.title, ...(metric.title_i18n?.uk ? [metric.title_i18n.uk] : [])],
      },
    });
  }
}

export async function loadPersonaCorrelationRows(userId: string) {
  return prisma.correlationResult.findMany({
    where: { userId },
    include: { metricA: true, metricB: true },
  });
}

export async function countEntriesByStatus(userId: string) {
  const rows = await prisma.diaryEntry.groupBy({
    by: ['processingStatus'],
    where: { userId },
    _count: { _all: true },
  });
  return rows;
}
