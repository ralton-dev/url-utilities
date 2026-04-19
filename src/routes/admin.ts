import type { FastifyPluginAsync } from 'fastify';
import { and, asc, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import QRCode from 'qrcode';
import { db } from '../clients/db.js';
import { urls, qrCodes } from '../db/schema.js';
import { requireApiKey } from '../plugins/auth.js';
import { env } from '../env.js';
import {
  aliasParam,
  adminListQuery,
  adminUpdateBody,
} from '../validation/admin.js';

const adminOpts = { preHandler: requireApiKey } as const;

type SortKey = 'createdAt' | 'alias' | 'count' | 'url';

function sortOrder(sort: string) {
  const dir = sort.startsWith('-') ? desc : asc;
  const field = sort.replace(/^-/, '') as SortKey;
  const col =
    field === 'alias'
      ? urls.alias
      : field === 'count'
        ? urls.count
        : field === 'url'
          ? urls.url
          : urls.createdAt;
  return [dir(col), asc(urls.id)];
}

async function renderQr(alias: string): Promise<string> {
  return QRCode.toDataURL(`${env.APP_URL}/r/${alias}`, {
    errorCorrectionLevel: 'H',
  });
}

async function upsertQr(urlId: number, qrCode: string): Promise<void> {
  const [existing] = await db
    .select({ id: qrCodes.id })
    .from(qrCodes)
    .where(eq(qrCodes.urlId, urlId))
    .limit(1);
  if (existing) {
    await db.update(qrCodes).set({ qrCode }).where(eq(qrCodes.id, existing.id));
  } else {
    await db.insert(qrCodes).values({ urlId, qrCode });
  }
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/admin/urls', adminOpts, async (req, reply) => {
    const parsed = adminListQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({
        success: false,
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const { q, page, pageSize, sort, minCount, maxCount } = parsed.data;

    const filters = [];
    if (q) {
      filters.push(or(ilike(urls.alias, `%${q}%`), ilike(urls.url, `%${q}%`)));
    }
    if (minCount !== undefined) filters.push(gte(urls.count, minCount));
    if (maxCount !== undefined) filters.push(lte(urls.count, maxCount));
    const where = filters.length ? and(...filters) : undefined;

    const [countRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(urls)
      .where(where);

    const rows = await db
      .select({
        id: urls.id,
        alias: urls.alias,
        url: urls.url,
        count: urls.count,
        createdAt: urls.createdAt,
      })
      .from(urls)
      .where(where)
      .orderBy(...sortOrder(sort))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return {
      success: true,
      data: {
        items: rows.map((r) => ({
          id: r.id,
          alias: r.alias,
          url: r.url,
          count: r.count ?? 0,
          createdAt: r.createdAt.toISOString(),
        })),
        total: countRow.total,
        page,
        pageSize,
      },
    };
  });

  app.get<{ Params: { alias: string } }>(
    '/api/admin/urls/:alias',
    adminOpts,
    async (req, reply) => {
      const parsed = aliasParam.safeParse(req.params);
      if (!parsed.success) {
        return reply.code(404).send({ success: false, errors: ['Not found'] });
      }
      const { alias } = parsed.data;

      const [row] = await db
        .select()
        .from(urls)
        .where(eq(urls.alias, alias))
        .limit(1);
      if (!row) {
        return reply.code(404).send({ success: false, errors: ['Not found'] });
      }

      const [qrRow] = await db
        .select({ qrCode: qrCodes.qrCode })
        .from(qrCodes)
        .where(eq(qrCodes.urlId, row.id))
        .limit(1);

      let qrCode: string | null = qrRow?.qrCode ?? null;
      if (!qrCode) {
        qrCode = await renderQr(alias);
        await upsertQr(row.id, qrCode);
      }

      return {
        success: true,
        data: {
          id: row.id,
          alias: row.alias,
          url: row.url,
          count: row.count ?? 0,
          createdAt: row.createdAt.toISOString(),
          qrCode,
        },
      };
    }
  );

  app.patch<{ Params: { alias: string } }>(
    '/api/admin/urls/:alias',
    adminOpts,
    async (req, reply) => {
      const paramParsed = aliasParam.safeParse(req.params);
      if (!paramParsed.success) {
        return reply.code(404).send({ success: false, errors: ['Not found'] });
      }
      const bodyParsed = adminUpdateBody.safeParse(req.body);
      if (!bodyParsed.success) {
        return reply.code(400).send({
          success: false,
          errors: bodyParsed.error.flatten().fieldErrors,
        });
      }
      const { alias } = paramParsed.data;

      const [row] = await db
        .select()
        .from(urls)
        .where(eq(urls.alias, alias))
        .limit(1);
      if (!row) {
        return reply.code(404).send({ success: false, errors: ['Not found'] });
      }

      await db
        .update(urls)
        .set({ url: bodyParsed.data.url })
        .where(eq(urls.alias, alias));

      const [qrRow] = await db
        .select({ qrCode: qrCodes.qrCode })
        .from(qrCodes)
        .where(eq(qrCodes.urlId, row.id))
        .limit(1);

      return {
        success: true,
        data: {
          id: row.id,
          alias: row.alias,
          url: bodyParsed.data.url,
          count: row.count ?? 0,
          createdAt: row.createdAt.toISOString(),
          qrCode: qrRow?.qrCode ?? null,
        },
      };
    }
  );

  app.delete<{ Params: { alias: string } }>(
    '/api/admin/urls/:alias',
    adminOpts,
    async (req, reply) => {
      const parsed = aliasParam.safeParse(req.params);
      if (!parsed.success) {
        return reply.code(404).send({ success: false, errors: ['Not found'] });
      }
      const { alias } = parsed.data;

      const [row] = await db
        .select({ id: urls.id })
        .from(urls)
        .where(eq(urls.alias, alias))
        .limit(1);
      if (!row) {
        return reply.code(404).send({ success: false, errors: ['Not found'] });
      }

      await db.transaction(async (tx) => {
        await tx.delete(qrCodes).where(eq(qrCodes.urlId, row.id));
        await tx.delete(urls).where(eq(urls.id, row.id));
      });

      return reply.code(204).send();
    }
  );

  app.post<{ Params: { alias: string } }>(
    '/api/admin/urls/:alias/qr/regenerate',
    adminOpts,
    async (req, reply) => {
      const parsed = aliasParam.safeParse(req.params);
      if (!parsed.success) {
        return reply.code(404).send({ success: false, errors: ['Not found'] });
      }
      const { alias } = parsed.data;

      const [row] = await db
        .select({ id: urls.id })
        .from(urls)
        .where(eq(urls.alias, alias))
        .limit(1);
      if (!row) {
        return reply.code(404).send({ success: false, errors: ['Not found'] });
      }

      const qrCode = await renderQr(alias);
      await upsertQr(row.id, qrCode);

      return { success: true, data: { qrCode } };
    }
  );

  app.get('/api/admin/stats', adminOpts, async () => {
    const [agg] = await db
      .select({
        totalUrls: sql<number>`count(*)::int`,
        totalClicks: sql<number>`coalesce(sum(${urls.count}), 0)::int`,
      })
      .from(urls);

    const topRows = await db
      .select({
        alias: urls.alias,
        url: urls.url,
        count: urls.count,
        createdAt: urls.createdAt,
      })
      .from(urls)
      .orderBy(desc(urls.count), asc(urls.id))
      .limit(10);

    return {
      success: true,
      data: {
        totalUrls: agg.totalUrls,
        totalClicks: agg.totalClicks,
        topUrls: topRows.map((r) => ({
          alias: r.alias,
          url: r.url,
          count: r.count ?? 0,
          createdAt: r.createdAt.toISOString(),
        })),
      },
    };
  });
};
