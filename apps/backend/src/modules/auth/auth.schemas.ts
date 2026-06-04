import { z } from 'zod';

export const telegramTokenBodySchema = z.object({
  token: z.string().min(16),
});

export const telegramLoginLinkSchema = z.object({
  telegramUserId: z.coerce.number().int().positive(),
  username: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  languageCode: z.string().optional().nullable(),
});
