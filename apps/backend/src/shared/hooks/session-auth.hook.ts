import type { FastifyReply, FastifyRequest } from 'fastify';
import { ApiError } from '../errors/api-error.js';
import { resolveSession } from '../../modules/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../../modules/auth/auth.constants.js';
import { sessionCookieClearOptions } from '../../modules/auth/session-cookie.js';

export async function requireSession(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const rawToken = request.cookies[SESSION_COOKIE_NAME];
  const resolved = await resolveSession(rawToken);

  if (!resolved) {
    reply.clearCookie(SESSION_COOKIE_NAME, sessionCookieClearOptions());
    throw new ApiError(401, 'UNAUTHORIZED', 'Sign in required');
  }

  request.authUser = resolved.user;
  request.telegramUsername = resolved.telegramUsername;
}
