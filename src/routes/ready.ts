import type { FastifyPluginAsync } from 'fastify';
import { client } from '../clients/db.js';

export const ready: FastifyPluginAsync = async (app) => {
  app.get('/api/ready', async (_req, reply) => {
    try {
      await client`SELECT 1`;
      return { status: 'ok' };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });
};
