import type { AuthMeResponse, AuthTelegramTokenResponse } from '@metrixify/shared-types';
import { apiFetch } from './client';

export async function fetchMe(): Promise<AuthMeResponse | null> {
  const response = await apiFetch('/api/auth/me');
  if (response.status === 401) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load session (${response.status})`);
  }
  return response.json() as Promise<AuthMeResponse>;
}

export async function exchangeTelegramToken(token: string): Promise<AuthTelegramTokenResponse> {
  const response = await apiFetch('/api/auth/telegram-token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    const message = body?.error?.message ?? `Login failed (${response.status})`;
    throw new Error(message);
  }
  return response.json() as Promise<AuthTelegramTokenResponse>;
}

export async function logout(): Promise<void> {
  const response = await apiFetch('/api/auth/logout', { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Logout failed (${response.status})`);
  }
}
