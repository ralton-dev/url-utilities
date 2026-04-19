import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../clients/db.js';
import { urls } from '../db/schema.js';

export const redirect: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { '*': string } }>('/r/*', async (req, reply) => {
    const alias = req.params['*'];

    const [row] = await db
      .select({ url: urls.url, count: urls.count })
      .from(urls)
      .where(eq(urls.alias, alias))
      .limit(1);

    if (!row || !row.url) {
      return reply.code(404).send('Not found');
    }

    await db
      .update(urls)
      .set({ count: (row.count ?? 0) + 1 })
      .where(eq(urls.alias, alias));

    return reply.redirect(row.url, 301);
  });
};
