import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import postgres from 'postgres';
import { makeApp, resetDb } from './helpers.js';

async function shorten(app: FastifyInstance, url: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/url',
    headers: { 'x-api-key': 'test-key' },
    payload: { url },
  });
  const body = res.json() as { url: string };
  return body.url.split('/').pop()!;
}

describe('GET /r/:alias', () => {
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

  it('returns 404 for unknown alias', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/r/doesnotexist',
    });
    expect(res.statusCode).toBe(404);
  });

  it('redirects 301 to original url', async () => {
    const target = 'https://example.com/redirect-target';
    const alias = await shorten(app, target);

    const res = await app.inject({ method: 'GET', url: `/r/${alias}` });
    expect(res.statusCode).toBe(301);
    expect(res.headers.location).toBe(target);
  });

  it('increments click count on each redirect', async () => {
    const alias = await shorten(app, 'https://example.com/counter');

    for (let i = 0; i < 3; i++) {
      const res = await app.inject({ method: 'GET', url: `/r/${alias}` });
      expect(res.statusCode).toBe(301);
    }

    const sql = postgres(process.env.POSTGRES_URL!, { max: 1 });
    try {
      const [row] = await sql<{ count: number }[]>`
        SELECT count FROM urls WHERE alias = ${alias}
      `;
      expect(row.count).toBe(3);
    } finally {
      await sql.end();
    }
  });
});
