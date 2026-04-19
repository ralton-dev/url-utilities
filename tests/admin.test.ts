import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { db } from '../src/clients/db.js';
import { qrCodes, urls } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { makeApp, resetDb } from './helpers.js';

const AUTH = { 'x-api-key': 'test-key' };

type SeedInput = {
  alias: string;
  url: string;
  count?: number;
  createdAt?: Date;
};

async function seed(rows: SeedInput[]): Promise<void> {
  for (const r of rows) {
    await db.insert(urls).values({
      alias: r.alias,
      url: r.url,
      count: r.count ?? 0,
      ...(r.createdAt ? { createdAt: r.createdAt } : {}),
    });
  }
}

describe('admin endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await makeApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb();
  });

  describe('auth', () => {
    it.each([
      ['GET', '/api/admin/urls'],
      ['GET', '/api/admin/urls/aaaaaaaaaa'],
      ['PATCH', '/api/admin/urls/aaaaaaaaaa'],
      ['DELETE', '/api/admin/urls/aaaaaaaaaa'],
      ['POST', '/api/admin/urls/aaaaaaaaaa/qr/regenerate'],
      ['GET', '/api/admin/stats'],
    ])('%s %s rejects without x-api-key', async (method, url) => {
      const res = await app.inject({
        method: method as 'GET',
        url,
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/admin/urls', () => {
    it('returns empty list when no urls exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/urls',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({
        success: true,
        data: { items: [], total: 0, page: 1, pageSize: 20 },
      });
    });

    it('paginates and returns total across pages', async () => {
      const seeds: SeedInput[] = [];
      for (let i = 0; i < 25; i++) {
        seeds.push({
          alias: `a${String(i).padStart(9, '0')}`,
          url: `https://example.com/${i}`,
        });
      }
      await seed(seeds);

      const page1 = await app.inject({
        method: 'GET',
        url: '/api/admin/urls?page=1&pageSize=10',
        headers: AUTH,
      });
      expect(page1.statusCode).toBe(200);
      expect(page1.json().data.items).toHaveLength(10);
      expect(page1.json().data.total).toBe(25);

      const page3 = await app.inject({
        method: 'GET',
        url: '/api/admin/urls?page=3&pageSize=10',
        headers: AUTH,
      });
      expect(page3.json().data.items).toHaveLength(5);
    });

    it('filters by free-text query on alias and url', async () => {
      await seed([
        { alias: 'keepxxxxxx', url: 'https://example.com/alpha' },
        { alias: 'otheralia1', url: 'https://example.com/needle-match' },
        { alias: 'somethingY', url: 'https://example.com/bravo' },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/urls?q=needle',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.items).toHaveLength(1);
      expect(res.json().data.items[0].alias).toBe('otheralia1');
    });

    it('sorts by -count desc', async () => {
      await seed([
        { alias: 'low0000000', url: 'https://example.com/a', count: 1 },
        { alias: 'high000000', url: 'https://example.com/b', count: 99 },
        { alias: 'mid0000000', url: 'https://example.com/c', count: 50 },
      ]);
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/urls?sort=-count',
        headers: AUTH,
      });
      const aliases = res
        .json()
        .data.items.map((i: { alias: string }) => i.alias);
      expect(aliases).toEqual(['high000000', 'mid0000000', 'low0000000']);
    });

    it('applies minCount and maxCount bounds', async () => {
      await seed([
        { alias: 'a000000000', url: 'https://example.com/a', count: 1 },
        { alias: 'b000000000', url: 'https://example.com/b', count: 10 },
        { alias: 'c000000000', url: 'https://example.com/c', count: 100 },
      ]);
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/urls?minCount=5&maxCount=50',
        headers: AUTH,
      });
      const aliases = res
        .json()
        .data.items.map((i: { alias: string }) => i.alias);
      expect(aliases).toEqual(['b000000000']);
    });

    it('rejects pageSize > 100', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/urls?pageSize=500',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/admin/urls/:alias', () => {
    it('returns 404 for missing alias', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/urls/doesnotexis',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 404 for malformed alias', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/urls/short',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(404);
    });

    it('lazy-populates qrCode on first detail read and reuses on next', async () => {
      await seed([{ alias: 'xyz0000000', url: 'https://example.com/xyz' }]);

      const first = await app.inject({
        method: 'GET',
        url: '/api/admin/urls/xyz0000000',
        headers: AUTH,
      });
      expect(first.statusCode).toBe(200);
      const qr1 = first.json().data.qrCode as string;
      expect(qr1).toMatch(/^data:image\/png;base64,/);

      const persisted = await db
        .select()
        .from(qrCodes)
        .where(eq(qrCodes.urlId, first.json().data.id));
      expect(persisted).toHaveLength(1);

      const second = await app.inject({
        method: 'GET',
        url: '/api/admin/urls/xyz0000000',
        headers: AUTH,
      });
      expect(second.json().data.qrCode).toBe(qr1);

      const stillOne = await db
        .select()
        .from(qrCodes)
        .where(eq(qrCodes.urlId, first.json().data.id));
      expect(stillOne).toHaveLength(1);
    });
  });

  describe('PATCH /api/admin/urls/:alias', () => {
    it('updates the destination url', async () => {
      await seed([{ alias: 'patch00000', url: 'https://old.example.com' }]);

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/urls/patch00000',
        headers: AUTH,
        payload: { url: 'https://new.example.com/path' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.url).toBe('https://new.example.com/path');

      const [row] = await db
        .select()
        .from(urls)
        .where(eq(urls.alias, 'patch00000'));
      expect(row.url).toBe('https://new.example.com/path');
    });

    it('400 on invalid url', async () => {
      await seed([{ alias: 'patch00000', url: 'https://old.example.com' }]);
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/urls/patch00000',
        headers: AUTH,
        payload: { url: 'not-a-url' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().errors.url).toBeDefined();
    });

    it('404 when alias not found', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/admin/urls/missing000',
        headers: AUTH,
        payload: { url: 'https://example.com' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/admin/urls/:alias', () => {
    it('deletes url and cascades qr row', async () => {
      await seed([{ alias: 'del0000000', url: 'https://example.com/del' }]);
      // ensure qr exists
      await app.inject({
        method: 'POST',
        url: '/api/admin/urls/del0000000/qr/regenerate',
        headers: AUTH,
      });

      const res = await app.inject({
        method: 'DELETE',
        url: '/api/admin/urls/del0000000',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(204);
      expect(res.body).toBe('');

      const rows = await db
        .select()
        .from(urls)
        .where(eq(urls.alias, 'del0000000'));
      expect(rows).toHaveLength(0);

      const qrRows = await db.select().from(qrCodes);
      expect(qrRows).toHaveLength(0);
    });

    it('404 when alias not found', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/admin/urls/missing000',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /api/admin/urls/:alias/qr/regenerate', () => {
    it('generates and persists a qr, and overwrites on second call', async () => {
      await seed([{ alias: 'qrgen00000', url: 'https://example.com/qr' }]);

      const first = await app.inject({
        method: 'POST',
        url: '/api/admin/urls/qrgen00000/qr/regenerate',
        headers: AUTH,
      });
      expect(first.statusCode).toBe(200);
      expect(first.json().data.qrCode).toMatch(/^data:image\/png;base64,/);

      const second = await app.inject({
        method: 'POST',
        url: '/api/admin/urls/qrgen00000/qr/regenerate',
        headers: AUTH,
      });
      expect(second.statusCode).toBe(200);

      const [row] = await db
        .select()
        .from(urls)
        .where(eq(urls.alias, 'qrgen00000'));
      const qrRows = await db
        .select()
        .from(qrCodes)
        .where(eq(qrCodes.urlId, row.id));
      expect(qrRows).toHaveLength(1);
    });

    it('404 when alias not found', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/admin/urls/missing000/qr/regenerate',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/admin/stats', () => {
    it('returns totals and top 10 by count', async () => {
      const seeds: SeedInput[] = [];
      for (let i = 0; i < 12; i++) {
        seeds.push({
          alias: `s${String(i).padStart(9, '0')}`,
          url: `https://example.com/${i}`,
          count: i,
        });
      }
      await seed(seeds);

      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/stats',
        headers: AUTH,
      });
      expect(res.statusCode).toBe(200);
      const { data } = res.json();
      expect(data.totalUrls).toBe(12);
      expect(data.totalClicks).toBe(66); // 0+1+...+11
      expect(data.topUrls).toHaveLength(10);
      expect(data.topUrls[0].count).toBe(11);
      expect(data.topUrls[9].count).toBe(2);
    });

    it('returns zeros with empty db', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/stats',
        headers: AUTH,
      });
      expect(res.json().data).toEqual({
        totalUrls: 0,
        totalClicks: 0,
        topUrls: [],
      });
    });
  });
});
