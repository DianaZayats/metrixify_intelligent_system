import { ApiError } from '../../shared/errors/api-error.js';
import {
  archiveProfileFactForUser,
  findProfileFactByIdForUser,
  listProfileFactsForUser,
  updateProfileFactForUser,
} from './profile-fact.repository.js';
import type { UpdateProfileFactBody } from './profile-fact.schemas.js';

export async function getProfileFactsForUser(
  userId: string,
  params?: { status?: 'active' | 'archived' | 'outdated' },
) {
  return listProfileFactsForUser(userId, params);
}

export async function getProfileFactByIdForUser(id: string, userId: string) {
  const fact = await findProfileFactByIdForUser(id, userId);
  if (!fact) {
    throw new ApiError(404, 'NOT_FOUND', 'Profile fact not found');
  }
  return fact;
}

export async function updateProfileFactItemForUser(
  id: string,
  userId: string,
  body: UpdateProfileFactBody,
) {
  const fact = await findProfileFactByIdForUser(id, userId);
  if (!fact) {
    throw new ApiError(404, 'NOT_FOUND', 'Profile fact not found');
  }
  if (fact.status === 'archived') {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Archived profile facts cannot be edited');
  }

  return updateProfileFactForUser({
    id,
    userId,
    valueText: body.valueText,
    factType: body.factType,
  });
}

export async function archiveProfileFactItemForUser(id: string, userId: string) {
  const fact = await findProfileFactByIdForUser(id, userId);
  if (!fact) {
    throw new ApiError(404, 'NOT_FOUND', 'Profile fact not found');
  }
  if (fact.status === 'archived') {
    return fact;
  }

  return archiveProfileFactForUser(id, userId);
}
