import { z } from 'zod';

export const entrySummaryOutputSchema = z.object({
  summary: z.string().min(1).max(500),
  language: z.string().min(2).max(10).optional(),
});

export type EntrySummaryOutput = z.infer<typeof entrySummaryOutputSchema>;

export const entrySummaryContextSchema = z.object({
  schema_version: z.literal('1'),
  entry: z.object({
    id: z.string(),
    entry_date: z.string(),
    source_type: z.enum(['text', 'voice', 'manual']),
    text: z.string(),
  }),
  user: z.object({
    timezone: z.string(),
    preferred_locale: z.enum(['en', 'uk']),
  }),
  recent_entries: z.array(
    z.object({
      entry_date: z.string(),
      summary: z.string().nullable(),
    }),
  ),
  existing_profile_facts: z.array(
    z.object({
      key: z.string(),
      value_text: z.string(),
    }),
  ),
});

export type EntrySummaryContextPack = z.infer<typeof entrySummaryContextSchema>;
