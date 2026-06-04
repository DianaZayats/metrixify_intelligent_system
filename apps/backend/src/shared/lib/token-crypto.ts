import { createHash, randomBytes } from 'node:crypto';
import { getSessionSecret } from '@metrixify/config';

/** Opaque bearer value sent to the client (login link or session cookie). */
export function generateRawToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Store only the hash in the database. */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(`${getSessionSecret()}:${rawToken}`).digest('hex');
}
