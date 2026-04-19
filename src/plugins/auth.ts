import type { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../env.js';

export const requireApiKey = async (
  req: FastifyRequest,
  reply: FastifyReply
) => {
  if (req.headers['x-api-key'] !== env.API_KEY) {
    return reply.code(401).send({ success: false, errors: ['Unauthorized'] });
  }
};
