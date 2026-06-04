import { z } from 'zod';
import { APP_LOCALES } from '@metrixify/shared-types';

export const localizedStringSchema = z.object({
  en: z.string().min(1),
  uk: z.string().min(1).optional(),
});

/** OpenAI structured outputs require every property in `required`; use nullable instead of optional. */
export const openAiLocalizedStringSchema = z.object({
  en: z.string().min(1),
  uk: z.string().min(1).nullable(),
});

export type LocalizedStringPayload = z.infer<typeof localizedStringSchema>;

export const updateUserLocaleBodySchema = z.object({
  locale: z.enum(APP_LOCALES),
});
