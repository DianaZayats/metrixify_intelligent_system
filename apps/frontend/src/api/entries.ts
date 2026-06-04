import type { DiaryEntryDetail, EntriesListResponse } from '@metrixify/shared-types';
import { apiFetch } from './client';

export async function fetchEntries(limit = 50, offset = 0): Promise<EntriesListResponse> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const response = await apiFetch(`/api/entries?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to load entries (${response.status})`);
  }
  return response.json() as Promise<EntriesListResponse>;
}

export async function fetchEntry(id: string): Promise<DiaryEntryDetail> {
  const response = await apiFetch(`/api/entries/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to load entry (${response.status})`);
  }
  return response.json() as Promise<DiaryEntryDetail>;
}

async function readApiErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    if (body.error?.message) {
      return body.error.message;
    }
  } catch {
    // ignore parse errors
  }
  return fallback;
}

export async function reprocessEntryMetrics(id: string): Promise<DiaryEntryDetail> {
  const response = await apiFetch(`/api/entries/${id}/reprocess`, { method: 'POST' });
  if (!response.ok) {
    const fallback = `Failed to re-extract metrics (${response.status})`;
    throw new Error(await readApiErrorMessage(response, fallback));
  }
  return response.json() as Promise<DiaryEntryDetail>;
}
