import type {
  ProfileFactListItem,
  ProfileFactsListResponse,
  UpdateProfileFactPayload,
} from '@metrixify/shared-types';
import { apiFetch } from './client';

export async function fetchProfileFacts(params?: {
  status?: 'active' | 'archived' | 'outdated';
}): Promise<ProfileFactsListResponse> {
  const search = new URLSearchParams();
  if (params?.status) {
    search.set('status', params.status);
  }
  const query = search.toString();
  const response = await apiFetch(`/api/profile-facts${query ? `?${query}` : ''}`);
  if (!response.ok) {
    throw new Error(`Failed to load profile facts (${response.status})`);
  }
  return response.json() as Promise<ProfileFactsListResponse>;
}

export async function updateProfileFact(
  id: string,
  payload: UpdateProfileFactPayload,
): Promise<ProfileFactListItem> {
  const response = await apiFetch(`/api/profile-facts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Failed to update profile fact (${response.status})`);
  }
  return response.json() as Promise<ProfileFactListItem>;
}

export async function archiveProfileFact(id: string): Promise<ProfileFactListItem> {
  const response = await apiFetch(`/api/profile-facts/${id}/archive`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Failed to archive profile fact (${response.status})`);
  }
  return response.json() as Promise<ProfileFactListItem>;
}
