import { z } from 'zod';
import type { LocalizedString, TagsI18nMap } from '@metrixify/shared-types';
import { localizedStringSchema } from '../../shared/schemas/localized-string.schema.js';
import { uniqueMetricTags } from './metric-normalization.js';

export const metricTagEntrySchema = z.object({
  slug: z.string().min(1).max(32),
  label_i18n: localizedStringSchema,
});

export function buildTagsI18nFromEntries(
  entries: Array<{ slug: string; label_i18n: LocalizedString }>,
): TagsI18nMap {
  const map: TagsI18nMap = {};
  for (const entry of entries) {
    const slug = entry.slug.trim().toLowerCase().replace(/\s+/g, '-');
    if (!slug) {
      continue;
    }
    map[slug] = entry.label_i18n;
  }
  return map;
}

export function mergeTagsI18n(
  existing: TagsI18nMap | null | undefined,
  incoming: TagsI18nMap,
): TagsI18nMap {
  return { ...(existing ?? {}), ...incoming };
}

export function mergeLocalizedString(
  existing: LocalizedString | null | undefined,
  incoming: LocalizedString,
): LocalizedString {
  const en = incoming.en?.trim() || existing?.en?.trim() || '';
  const uk = incoming.uk?.trim() || existing?.uk?.trim();
  return uk ? { en, uk } : { en };
}

export function ensureCandidateI18n<
  T extends {
    title: string;
    title_i18n?: LocalizedString;
    tags: string[];
    tags_i18n?: TagsI18nMap;
    tag_entries?: Array<{ slug: string; label_i18n: LocalizedString }>;
  },
>(candidate: T): T & { title_i18n: LocalizedString; tags: string[]; tags_i18n: TagsI18nMap } {
  const tagEntries =
    candidate.tag_entries ??
    candidate.tags.map((slug) => ({
      slug,
      label_i18n: candidate.tags_i18n?.[slug] ?? { en: slug },
    }));

  const slugs = uniqueMetricTags(tagEntries.map((entry) => entry.slug));
  const tagsI18n = buildTagsI18nFromEntries(
    tagEntries.filter((entry) => slugs.includes(entry.slug.trim().toLowerCase().replace(/\s+/g, '-'))),
  );

  for (const slug of slugs) {
    if (!tagsI18n[slug]) {
      tagsI18n[slug] = { en: slug };
    }
  }

  const titleI18n = candidate.title_i18n ?? { en: candidate.title.trim() };
  if (!titleI18n.en.trim()) {
    titleI18n.en = candidate.title.trim();
  }

  return {
    ...candidate,
    title: titleI18n.en.trim(),
    title_i18n: titleI18n,
    tags: slugs,
    tags_i18n: tagsI18n,
  };
}

export type MetricTagEntry = z.infer<typeof metricTagEntrySchema>;
