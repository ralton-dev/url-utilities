import type { FastifyPluginAsync } from 'fastify';

export const health: FastifyPluginAsync = async (app) => {
  app.get('/api/health', async () => ({ status: 'ok' }));
};
