import { z } from 'zod';

export const DELETE_USER_DATA_CONFIRM_PHRASE = 'DELETE';

export const deleteUserDataBodySchema = z.object({
  confirm: z.literal(DELETE_USER_DATA_CONFIRM_PHRASE),
});

export type DeleteUserDataBody = z.infer<typeof deleteUserDataBodySchema>;

export const userExportQuerySchema = z.object({
  format: z.enum(['json', 'xlsx']).default('json'),
});

export type UserExportQuery = z.infer<typeof userExportQuerySchema>;
