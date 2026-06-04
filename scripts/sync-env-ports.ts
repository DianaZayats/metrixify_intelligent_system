/**
 * Updates REDIS_PORT / REDIS_URL in .env to match .env.example defaults when still on old values.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const envPath = resolve(root, '.env');

if (!existsSync(envPath)) {
  console.log('[sync-env-ports] No .env file — nothing to update');
  process.exit(0);
}

let content = readFileSync(envPath, 'utf8');
let changed = false;

if (/^REDIS_PORT=6379\s*$/m.test(content)) {
  content = content.replace(/^REDIS_PORT=6379\s*$/m, 'REDIS_PORT=6380');
  changed = true;
}

if (/^REDIS_URL=redis:\/\/localhost:6379\s*$/m.test(content)) {
  content = content.replace(
    /^REDIS_URL=redis:\/\/localhost:6379\s*$/m,
    'REDIS_URL=redis://localhost:6380',
  );
  changed = true;
}

if (/^VITE_API_BASE_URL=http:\/\/localhost:3000\s*$/m.test(content)) {
  content = content.replace(
    /^VITE_API_BASE_URL=http:\/\/localhost:3000\s*$/m,
    'VITE_API_BASE_URL=http://127.0.0.1:3000',
  );
  changed = true;
}

if (/^BACKEND_URL=http:\/\/localhost:3000\s*$/m.test(content)) {
  content = content.replace(
    /^BACKEND_URL=http:\/\/localhost:3000\s*$/m,
    'BACKEND_URL=http://127.0.0.1:3000',
  );
  changed = true;
}

if (changed) {
  writeFileSync(envPath, content, 'utf8');
  console.log('[sync-env-ports] Updated Redis port to 6380 in .env');
} else {
  console.log('[sync-env-ports] .env Redis settings already OK');
}
