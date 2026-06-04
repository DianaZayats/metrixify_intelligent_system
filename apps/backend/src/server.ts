import { getConfig } from '@metrixify/config';
import { buildApp } from './app.js';

async function start() {
  const config = getConfig();
  const app = await buildApp();

  try {
    await app.listen({ port: config.BACKEND_PORT, host: '0.0.0.0' });
    app.log.info(`Backend listening on http://localhost:${config.BACKEND_PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();
