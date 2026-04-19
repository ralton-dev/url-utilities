import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { makeApp, resetDb } from './helpers.js';

describe('POST /api/url', () => {
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
      url: '/api/url',
      payload: { url: 'https://example.com' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({
      success: false,
      errors: ['Unauthorized'],
    });
  });

  it('rejects with wrong x-api-key', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/url',
      headers: { 'x-api-key': 'nope' },
      payload: { url: 'https://example.com' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when url is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/url',
      headers: { 'x-api-key': 'test-key' },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().success).toBe(false);
  });

  it('returns 400 when url is invalid', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/url',
      headers: { 'x-api-key': 'test-key' },
      payload: { url: 'not-a-url' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('creates a shortened url and returns alias', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/url',
      headers: { 'x-api-key': 'test-key' },
      payload: { url: 'https://example.com/foo' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.url).toMatch(/^http:\/\/test\.local\/r\/[0-9A-Za-z]{10}$/);
  });

  it('returns the same alias when called twice for the same url', async () => {
    const payload = { url: 'https://example.com/same' };
    const first = await app.inject({
      method: 'POST',
      url: '/api/url',
      headers: { 'x-api-key': 'test-key' },
      payload,
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/url',
      headers: { 'x-api-key': 'test-key' },
      payload,
    });
    expect(first.json().url).toBe(second.json().url);
  });

  it('returns different aliases for different urls', async () => {
    const a = await app.inject({
      method: 'POST',
      url: '/api/url',
      headers: { 'x-api-key': 'test-key' },
      payload: { url: 'https://example.com/a' },
    });
    const b = await app.inject({
      method: 'POST',
      url: '/api/url',
      headers: { 'x-api-key': 'test-key' },
      payload: { url: 'https://example.com/b' },
    });
    expect(a.json().url).not.toBe(b.json().url);
  });
});
