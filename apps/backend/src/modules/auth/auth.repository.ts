import type { LoginToken, Session, User } from '@prisma/client';
import { prisma } from '../../shared/db/prisma.js';

export async function createLoginToken(data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<LoginToken> {
  return prisma.loginToken.create({ data });
}

export async function findActiveLoginTokenByHash(
  tokenHash: string,
): Promise<LoginToken | null> {
  return prisma.loginToken.findFirst({
    where: {
      tokenHash,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
}

export async function consumeLoginToken(id: string): Promise<boolean> {
  const result = await prisma.loginToken.updateMany({
    where: { id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  return result.count > 0;
}

export async function createSession(data: {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}): Promise<Session> {
  return prisma.session.create({ data });
}

export async function findActiveSessionByHash(
  tokenHash: string,
): Promise<(Session & { user: User }) | null> {
  return prisma.session.findFirst({
    where: {
      tokenHash,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });
}

export async function deleteSessionByHash(tokenHash: string): Promise<void> {
  await prisma.session.deleteMany({ where: { tokenHash } });
}
