import Fastify, { type FastifyInstance } from 'fastify';
import sensible from '@fastify/sensible';
import { health } from './routes/health.js';
import { ready } from './routes/ready.js';
import { urlRoute } from './routes/url.js';
import { qrRoute } from './routes/qr.js';
import { redirect } from './routes/redirect.js';

export type BuildAppOptions = {
  logger?: boolean;
};

export async function buildApp(
  opts: BuildAppOptions = {}
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opts.logger ?? true,
    trustProxy: true,
  });

  await app.register(sensible);
  await app.register(health);
  await app.register(ready);
  await app.register(urlRoute);
  await app.register(qrRoute);
  await app.register(redirect);

  return app;
}
