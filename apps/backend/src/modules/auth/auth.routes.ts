import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  exchangeTelegramLoginToken,
  logoutSession,
  resolveSession,
  toAuthUser,
} from './auth.service.js';
import { telegramTokenBodySchema } from './auth.schemas.js';
import { SESSION_COOKIE_NAME } from './auth.constants.js';
import {
  sessionCookieClearOptions,
  sessionCookieSetOptions,
} from './session-cookie.js';
import { requireSession } from '../../shared/hooks/session-auth.hook.js';

function readSessionCookie(request: FastifyRequest): string | undefined {
  return request.cookies[SESSION_COOKIE_NAME];
}

function setSessionCookie(reply: FastifyReply, rawToken: string, expiresAt: Date): void {
  reply.setCookie(SESSION_COOKIE_NAME, rawToken, sessionCookieSetOptions(expiresAt));
}

function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE_NAME, sessionCookieClearOptions());
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/telegram-token', async (request, reply) => {
    const { token } = telegramTokenBodySchema.parse(request.body);
    const { rawSessionToken, expiresAt, user } = await exchangeTelegramLoginToken(token);
    const session = await resolveSession(rawSessionToken);
    const telegramUsername = session?.telegramUsername ?? null;

    setSessionCookie(reply, rawSessionToken, expiresAt);

    return {
      user: toAuthUser(user, telegramUsername),
    };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    await logoutSession(readSessionCookie(request));
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: requireSession }, async (request) => {
    return {
      user: toAuthUser(request.authUser, request.telegramUsername),
    };
  });
}
