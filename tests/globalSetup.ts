import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

let container: StartedPostgreSqlContainer | undefined;

export async function setup() {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('urlutil')
    .withUsername('test')
    .withPassword('test')
    .start();

  const connStr = container.getConnectionUri();

  process.env.APP_URL = 'http://test.local';
  process.env.API_KEY = 'test-key';
  process.env.POSTGRES_URL = connStr;
  process.env.PORT = '3000';

  const migrationClient = postgres(connStr, { max: 1 });
  try {
    await migrate(drizzle(migrationClient), {
      migrationsFolder: './src/db/migrations',
    });
  } finally {
    await migrationClient.end();
  }
}

export async function teardown() {
  await container?.stop();
}
