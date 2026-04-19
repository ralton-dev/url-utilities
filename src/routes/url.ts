import type { FastifyPluginAsync } from 'fastify';
import { urlSchema } from '../validation/url.js';
import { upsertUrl } from '../utils/upsertUrl.js';
import { requireApiKey } from '../plugins/auth.js';
import { env } from '../env.js';

export const urlRoute: FastifyPluginAsync = async (app) => {
  app.post('/api/url', { preHandler: requireApiKey }, async (req, reply) => {
    const parsed = urlSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    try {
      const alias = await upsertUrl(parsed.data.url);
      return { success: true, url: `${env.APP_URL}/r/${alias}` };
    } catch {
      return reply
        .code(422)
        .send({ success: false, errors: ['Error creating url'] });
    }
  });
};
