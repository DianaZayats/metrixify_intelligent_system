import { getConfig } from '@metrixify/config';

export function baseSessionCookieOptions() {
  const config = getConfig();
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    secure: config.NODE_ENV === 'production',
  };
}

export function sessionCookieSetOptions(expiresAt: Date) {
  const maxAgeSeconds = Math.max(
    0,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000),
  );
  return {
    ...baseSessionCookieOptions(),
    maxAge: maxAgeSeconds,
  };
}

export function sessionCookieClearOptions() {
  return baseSessionCookieOptions();
}
