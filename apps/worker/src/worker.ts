import { getConfig } from '@metrixify/config';

const config = getConfig();

console.log('[worker] Metrixify worker stub started');
console.log(`[worker] Redis URL: ${config.REDIS_URL}`);
console.log('[worker] BullMQ job processors will be implemented in stage 2+');

function keepAlive(): void {
  setInterval(() => {
    // Placeholder until process-entry.job.ts is implemented.
  }, 60_000);
}

keepAlive();
