import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Finds `.env` by walking up from cwd (npm workspace scripts run inside apps/*).
 */
export function findEnvFilePath(): string {
  let dir = process.cwd();

  while (true) {
    const envPath = resolve(dir, '.env');
    if (existsSync(envPath)) {
      return envPath;
    }

    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return resolve(process.cwd(), '.env');
}
