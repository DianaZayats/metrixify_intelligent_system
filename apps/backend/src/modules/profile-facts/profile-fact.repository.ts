import type {
  ProfileFact,
  ProfileFactEvidence,
  ProfileFactStability,
  ProfileFactStatus,
  ProfileFactType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../shared/db/prisma.js';
import { buildValueJson } from './profile-fact-deduplication.js';

export async function findProfileFactByKey(
  userId: string,
  key: string,
): Promise<ProfileFact | null> {
  return prisma.profileFact.findUnique({
    where: {
      userId_key: { userId, key },
    },
  });
}

export async function findProfileFactByIdForUser(
  id: string,
  userId: string,
): Promise<ProfileFact | null> {
  return prisma.profileFact.findFirst({
    where: { id, userId },
  });
}

export async function hasValidFactExtractionRun(entryId: string): Promise<boolean> {
  const run = await prisma.aiRun.findFirst({
    where: {
      entryId,
      runType: 'fact_extraction',
      validationStatus: 'valid',
    },
    select: { id: true },
  });
  return Boolean(run);
}

export async function listActiveProfileFactsForUser(
  userId: string,
  limit = 30,
): Promise<ProfileFact[]> {
  return prisma.profileFact.findMany({
    where: { userId, status: 'active' },
    orderBy: [{ updatedAt: 'desc' }, { key: 'asc' }],
    take: limit,
  });
}

export async function listProfileFactsForUser(
  userId: string,
  params?: { status?: ProfileFactStatus },
): Promise<ProfileFact[]> {
  return prisma.profileFact.findMany({
    where: {
      userId,
      ...(params?.status ? { status: params.status } : { status: 'active' }),
    },
    orderBy: [{ updatedAt: 'desc' }, { key: 'asc' }],
  });
}

export async function createProfileFact(params: {
  userId: string;
  key: string;
  valueText: string;
  valueI18n?: { en: string; uk?: string };
  factType: ProfileFactType;
  stability: ProfileFactStability;
  confidence: number;
  entryId: string;
}): Promise<ProfileFact> {
  const valueI18n = params.valueI18n ?? { en: params.valueText.trim() };
  return prisma.profileFact.create({
    data: {
      userId: params.userId,
      key: params.key,
      valueJson: buildValueJson(valueI18n.en),
      valueI18n,
      factType: params.factType,
      stability: params.stability,
      confidence: params.confidence,
      status: 'active',
      firstSeenEntryId: params.entryId,
      lastSeenEntryId: params.entryId,
      evidenceCount: 0,
    },
  });
}

export async function updateProfileFactFromExtraction(params: {
  factId: string;
  valueText: string;
  valueI18n?: { en: string; uk?: string };
  factType: ProfileFactType;
  stability: ProfileFactStability;
  confidence: number;
  entryId: string;
}): Promise<ProfileFact> {
  const valueI18n = params.valueI18n ?? { en: params.valueText.trim() };
  return prisma.profileFact.update({
    where: { id: params.factId },
    data: {
      valueJson: buildValueJson(valueI18n.en),
      valueI18n,
      factType: params.factType,
      stability: params.stability,
      confidence: params.confidence,
      lastSeenEntryId: params.entryId,
      status: 'active',
    },
  });
}

export async function appendProfileFactEvidence(params: {
  profileFactId: string;
  entryId: string;
  evidenceText: string;
}): Promise<ProfileFactEvidence> {
  const evidence = await prisma.profileFactEvidence.create({
    data: {
      profileFactId: params.profileFactId,
      entryId: params.entryId,
      evidenceText: params.evidenceText.trim(),
    },
  });

  await prisma.profileFact.update({
    where: { id: params.profileFactId },
    data: {
      evidenceCount: { increment: 1 },
      lastSeenEntryId: params.entryId,
    },
  });

  return evidence;
}

export async function updateProfileFactForUser(params: {
  id: string;
  userId: string;
  valueText?: string;
  factType?: ProfileFactType;
}): Promise<ProfileFact> {
  const existing = await findProfileFactByIdForUser(params.id, params.userId);
  if (!existing) {
    throw new Error('Profile fact not found');
  }

  const data: Prisma.ProfileFactUpdateInput = {};
  if (params.valueText !== undefined) {
    data.valueJson = buildValueJson(params.valueText);
  }
  if (params.factType !== undefined) {
    data.factType = params.factType;
  }

  return prisma.profileFact.update({
    where: { id: existing.id },
    data,
  });
}

export async function archiveProfileFactForUser(
  id: string,
  userId: string,
): Promise<ProfileFact> {
  const existing = await findProfileFactByIdForUser(id, userId);
  if (!existing) {
    throw new Error('Profile fact not found');
  }

  return prisma.profileFact.update({
    where: { id: existing.id },
    data: { status: 'archived' },
  });
}
