import type { User } from '@prisma/client';

declare module 'fastify' {
  interface FastifyRequest {
    authUser: User;
    telegramUsername: string | null;
  }
}
