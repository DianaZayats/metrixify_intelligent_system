import type { Prisma, User } from '@prisma/client';
import type { AppLocale } from '@metrixify/shared-types';
import { isAppLocale } from '@metrixify/shared-types';
import { prisma } from '../../shared/db/prisma.js';

export type TelegramProfile = {
  telegramUserId: bigint;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  languageCode?: string | null;
};

export async function createUser(data: Prisma.UserCreateInput): Promise<User> {
  return prisma.user.create({ data });
}

export async function updateUserLocale(userId: string, locale: AppLocale): Promise<User> {
  if (!isAppLocale(locale)) {
    throw new Error(`Invalid locale: ${locale}`);
  }
  return prisma.user.update({
    where: { id: userId },
    data: { locale },
  });
}

export async function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export async function findUserByTelegramId(telegramUserId: bigint): Promise<User | null> {
  return prisma.user.findFirst({
    where: {
      telegramAccounts: {
        some: { telegramUserId },
      },
    },
  });
}

export async function upsertUserFromTelegram(profile: TelegramProfile): Promise<User> {
  const existing = await prisma.telegramAccount.findUnique({
    where: { telegramUserId: profile.telegramUserId },
    include: { user: true },
  });

  if (existing) {
    await prisma.telegramAccount.update({
      where: { id: existing.id },
      data: {
        username: profile.username ?? undefined,
        firstName: profile.firstName ?? undefined,
        lastName: profile.lastName ?? undefined,
        languageCode: profile.languageCode ?? undefined,
      },
    });
    return existing.user;
  }

  return prisma.user.create({
    data: {
      timezone: 'UTC',
      telegramAccounts: {
        create: {
          telegramUserId: profile.telegramUserId,
          username: profile.username,
          firstName: profile.firstName,
          lastName: profile.lastName,
          languageCode: profile.languageCode,
        },
      },
    },
  });
}

/** Deletes diary, metrics, facts, analytics, and AI history for a user. Keeps user, Telegram link, and sessions. */
export async function deleteAllUserDataForUser(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.correlationResult.deleteMany({ where: { userId } });
    await tx.insightReport.deleteMany({ where: { userId } });
    await tx.metricObservation.deleteMany({ where: { userId } });
    await tx.profileFactEvidence.deleteMany({
      where: { profileFact: { userId } },
    });
    await tx.processingJob.deleteMany({ where: { userId } });
    await tx.aiRun.deleteMany({ where: { userId } });
    await tx.memoryChunk.deleteMany({ where: { userId } });
    await tx.telegramConversationTurn.deleteMany({ where: { userId } });
    await tx.entrySource.deleteMany({ where: { userId } });
    await tx.diaryEntry.deleteMany({ where: { userId } });
    await tx.metricDefinition.deleteMany({ where: { userId } });
    await tx.profileFact.deleteMany({ where: { userId } });
    await tx.loginToken.deleteMany({ where: { userId } });
  });
}
