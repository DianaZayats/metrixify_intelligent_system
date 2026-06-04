import type { User } from '@prisma/client';
import { getFrontendUrl } from '@metrixify/config';
import type { AuthUser } from '@metrixify/shared-types';
import { ApiError } from '../../shared/errors/api-error.js';
import { generateRawToken, hashToken } from '../../shared/lib/token-crypto.js';
import { prisma } from '../../shared/db/prisma.js';
import { upsertUserFromTelegram, type TelegramProfile } from '../users/user.repository.js';
import {
  LOGIN_TOKEN_TTL_MS,
  SESSION_TTL_MS,
} from './auth.constants.js';
import {
  consumeLoginToken,
  createLoginToken,
  createSession,
  deleteSessionByHash,
  findActiveLoginTokenByHash,
  findActiveSessionByHash,
} from './auth.repository.js';

export type SessionIssue = {
  rawSessionToken: string;
  expiresAt: Date;
  user: User;
};

async function loadTelegramUsername(userId: string): Promise<string | null> {
  const account = await prisma.telegramAccount.findFirst({
    where: { userId },
    select: { username: true },
  });
  return account?.username ?? null;
}

export function toAuthUser(user: User, telegramUsername: string | null): AuthUser {
  const locale = user.locale === 'uk' ? 'uk' : 'en';
  return {
    id: user.id,
    timezone: user.timezone,
    locale,
    telegramUsername,
  };
}

export async function createTelegramLoginLink(
  profile: TelegramProfile,
): Promise<{ loginUrl: string; expiresAt: Date }> {
  const user = await upsertUserFromTelegram(profile);
  const rawToken = generateRawToken();
  const expiresAt = new Date(Date.now() + LOGIN_TOKEN_TTL_MS);

  await createLoginToken({
    userId: user.id,
    tokenHash: hashToken(rawToken),
    expiresAt,
  });

  const frontendUrl = getFrontendUrl();
  const loginUrl = `${frontendUrl}/auth/telegram-token?token=${encodeURIComponent(rawToken)}`;

  return { loginUrl, expiresAt };
}

export async function exchangeTelegramLoginToken(rawToken: string): Promise<SessionIssue> {
  const tokenHash = hashToken(rawToken);

  const loginToken = await findActiveLoginTokenByHash(tokenHash);
  if (!loginToken) {
    throw new ApiError(401, 'INVALID_LOGIN_TOKEN', 'Login link is invalid, expired, or already used');
  }

  const consumed = await consumeLoginToken(loginToken.id);
  if (!consumed) {
    throw new ApiError(401, 'INVALID_LOGIN_TOKEN', 'Login link is invalid, expired, or already used');
  }

  const rawSessionToken = generateRawToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await createSession({
    userId: loginToken.userId,
    tokenHash: hashToken(rawSessionToken),
    expiresAt,
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: loginToken.userId } });
  return { rawSessionToken, expiresAt, user };
}

export async function resolveSession(
  rawSessionToken: string | undefined,
): Promise<{ user: User; telegramUsername: string | null } | null> {
  if (!rawSessionToken) {
    return null;
  }

  const session = await findActiveSessionByHash(hashToken(rawSessionToken));
  if (!session) {
    return null;
  }

  const telegramUsername = await loadTelegramUsername(session.userId);
  return { user: session.user, telegramUsername };
}

export async function logoutSession(rawSessionToken: string | undefined): Promise<void> {
  if (!rawSessionToken) {
    return;
  }
  await deleteSessionByHash(hashToken(rawSessionToken));
}
