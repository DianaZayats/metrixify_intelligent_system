import type { AppLocale, UpdateUserLocaleResponse } from '@metrixify/shared-types';
import { apiFetch } from './client';

export async function updateUserLocale(locale: AppLocale): Promise<UpdateUserLocaleResponse> {
  const response = await apiFetch('/api/user/locale', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locale }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update locale (${response.status})`);
  }
  return response.json() as Promise<UpdateUserLocaleResponse>;
}

export async function deleteAllUserData(): Promise<void> {
  const response = await apiFetch('/api/user/delete-data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: 'DELETE' }),
  });
  if (!response.ok) {
    throw new Error(`Failed to delete user data (${response.status})`);
  }
}

export async function downloadUserExport(format: 'json' | 'xlsx' = 'json'): Promise<void> {
  const response = await apiFetch(`/api/user/export?format=${format}`);
  if (!response.ok) {
    throw new Error(`Failed to export data (${response.status})`);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const fallbackExt = format === 'xlsx' ? 'xlsx' : 'json';
  const filename =
    match?.[1] ?? `metrixify-export-${new Date().toISOString().slice(0, 10)}.${fallbackExt}`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
