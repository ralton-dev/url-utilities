import { buildApp } from './app.js';
import { env } from './env.js';
import { client } from './clients/db.js';

const app = await buildApp();

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  try {
    await app.close();
    await client.end({ timeout: 5 });
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, 'error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

try {
  await app.listen({ host: '0.0.0.0', port: env.PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
