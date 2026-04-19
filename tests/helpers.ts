import type { FastifyInstance } from 'fastify';
import postgres from 'postgres';
import { buildApp } from '../src/app.js';

export async function makeApp(): Promise<FastifyInstance> {
  return buildApp({ logger: false });
}

export async function resetDb(): Promise<void> {
  const sql = postgres(process.env.POSTGRES_URL!, { max: 1 });
  try {
    await sql`TRUNCATE TABLE qr_codes, urls RESTART IDENTITY CASCADE`;
  } finally {
    await sql.end();
  }
}
