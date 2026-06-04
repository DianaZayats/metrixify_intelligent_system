import { z } from 'zod';
import { PROCESSING_STATUSES } from '@metrixify/shared-types';

export const entriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const entryIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const diaryEntryListItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  sourceType: z.enum(['text', 'voice', 'manual']),
  rawText: z.string().nullable(),
  summaryText: z.string().nullable(),
  entryDate: z.string(),
  processingStatus: z.enum(PROCESSING_STATUSES),
  createdAt: z.string(),
});

export const diaryEntryDetailSchema = diaryEntryListItemSchema.extend({
  transcriptText: z.string().nullable(),
  processingError: z.string().nullable(),
  updatedAt: z.string(),
  observations: z.array(
    z.object({
      id: z.string(),
      entryId: z.string(),
      metricDefinitionId: z.string(),
      metricKey: z.string(),
      metricTitle: z.string(),
      valueType: z.enum(['number', 'ordinal', 'boolean', 'category']),
      unit: z.string().nullable(),
      valueDisplay: z.string(),
      confidence: z.number().nullable(),
      evidenceText: z.string().nullable(),
      observedAt: z.string(),
    }),
  ),
});

export const entriesListResponseSchema = z.object({
  items: z.array(diaryEntryListItemSchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});

export const telegramVoiceIngestSchema = z.object({
  updateId: z.number().int().positive(),
  messageId: z.number().int().positive(),
  chatId: z.number().int(),
  chatType: z.string(),
  telegramUserId: z.number().int().positive(),
  username: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  languageCode: z.string().optional().nullable(),
  fileId: z.string().min(1),
  duration: z.number().int().positive(),
});

export const telegramVoiceIngestResponseSchema = z.object({
  entryId: z.string(),
  created: z.boolean(),
  transcribed: z.boolean(),
  processingStatus: z.enum(PROCESSING_STATUSES),
  processingError: z.string().nullable(),
  observations: diaryEntryDetailSchema.shape.observations,
});

export const telegramMessageIngestSchema = z.object({
  updateId: z.number().int().positive(),
  messageId: z.number().int().positive(),
  chatId: z.number().int(),
  chatType: z.string(),
  telegramUserId: z.number().int().positive(),
  username: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  languageCode: z.string().optional().nullable(),
  text: z.string().min(1),
});

export const telegramIngestResponseSchema = z.object({
  entryId: z.string(),
  created: z.boolean(),
  processingStatus: z.enum(PROCESSING_STATUSES),
  processingError: z.string().nullable(),
  observations: diaryEntryDetailSchema.shape.observations,
});

export const statusEntriesQuerySchema = z.object({
  telegramUserId: z.coerce.number().int().positive(),
});
