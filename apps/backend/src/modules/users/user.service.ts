import type { DeleteUserDataResponse } from '@metrixify/shared-types';
import { deleteAllUserDataForUser } from './user.repository.js';
import { exportUserDataForUser } from './user-export.service.js';

export async function deleteUserDataForUser(userId: string): Promise<DeleteUserDataResponse> {
  await deleteAllUserDataForUser(userId);
  return { deleted: true };
}

export { exportUserDataForUser };
