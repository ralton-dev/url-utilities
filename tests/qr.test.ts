import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { makeApp, resetDb } from './helpers.js';

describe('POST /api/qr', () => {
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

  it('rejects without x-api-key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/qr',
      payload: { url: 'https://example.com' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 on invalid url', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/qr',
      headers: { 'x-api-key': 'test-key' },
      payload: { url: 'not-a-url' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns a data-url QR code for a valid url', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/qr',
      headers: { 'x-api-key': 'test-key' },
      payload: { url: 'https://example.com/qr' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.url).toMatch(/^http:\/\/test\.local\/r\/[0-9A-Za-z]{10}$/);
    expect(body.qrCode).toMatch(/^data:image\/png;base64,/);
  });
});
