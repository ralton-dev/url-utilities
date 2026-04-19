import type { FastifyPluginAsync } from 'fastify';
import { asc, desc, sql } from 'drizzle-orm';
import { db } from '../../clients/db.js';
import { urls } from '../../db/schema.js';
import { adminOpts } from './shared.js';

export const adminStatsRoutes: FastifyPluginAsync = async (app) => {
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
