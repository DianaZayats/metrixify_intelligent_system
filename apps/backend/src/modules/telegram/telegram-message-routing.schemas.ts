import { z } from 'zod';

export const telegramMessageRoutingAiOutputSchema = z.object({
  intent: z.enum(['diary_entry', 'correction']),
  target_entry_id: z.string().nullable(),
  reasoning: z.string().min(1).max(500),
});

export type TelegramMessageRoutingAiOutput = z.infer<
  typeof telegramMessageRoutingAiOutputSchema
>;

export const telegramMessageRoutingContextPackSchema = z.object({
  schema_version: z.literal('1'),
  incoming_message: z.object({
    text: z.string(),
    reply_to_message_id: z.number().nullable(),
    reply_target_entry_id: z.string().nullable(),
  }),
  recent_conversation: z.array(
    z.object({
      role: z.enum(['user', 'bot']),
      turn_type: z.string(),
      text: z.string(),
      entry_id: z.string().nullable(),
      created_at: z.string(),
    }),
  ),
  recent_entries: z.array(
    z.object({
      id: z.string(),
      entry_date: z.string(),
      text_preview: z.string().nullable(),
      metric_titles: z.array(z.string()),
      processing_status: z.string(),
    }),
  ),
});

export type TelegramMessageRoutingContextPack = z.infer<
  typeof telegramMessageRoutingContextPackSchema
>;
