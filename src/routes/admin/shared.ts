import type { FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../../clients/db.js';
import { urls } from '../../db/schema.js';
import { requireApiKey } from '../../plugins/auth.js';

export const adminOpts = { preHandler: requireApiKey } as const;

export function notFound(reply: FastifyReply) {
  return reply.code(404).send({ success: false, errors: ['Not found'] });
}

export async function findUrlByAlias(alias: string) {
  const [row] = await db
    .select()
    .from(urls)
    .where(eq(urls.alias, alias))
    .limit(1);
  return row ?? null;
}
