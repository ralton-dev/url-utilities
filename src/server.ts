import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import { env } from './env.js';
import { client } from './clients/db.js';
import { health } from './routes/health.js';
import { ready } from './routes/ready.js';
import { urlRoute } from './routes/url.js';
import { qrRoute } from './routes/qr.js';
import { redirect } from './routes/redirect.js';

const app = Fastify({
  logger: true,
  trustProxy: true,
  disableRequestLogging: false,
});

await app.register(sensible);
await app.register(health);
await app.register(ready);
await app.register(urlRoute);
await app.register(qrRoute);
await app.register(redirect);

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
