import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import pg from 'pg';
import {
  backendRoot,
  databaseName,
  testDatabaseUrl,
} from './support/test-database.js';

/**
 * Runs once before all e2e files: makes sure the test database exists, applies
 * the migrations and leaves every table empty. Tests then create their own
 * data with unique emails, so they never depend on each other.
 */
export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();
  const name = databaseName(url);

  const created = await createDatabaseIfMissing(url, name);
  migrate(url);
  await truncateAllTables(url);

  console.log(
    `\n[e2e] base de datos "${name}" ${created ? 'creada' : 'ya existía'}, migrada y vacía\n`,
  );
}

async function createDatabaseIfMissing(
  url: string,
  name: string,
): Promise<boolean> {
  const admin = new URL(url);
  admin.pathname = '/postgres';
  admin.search = '';

  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [name],
    );
    if (rowCount) return false;
    // `name` already ends in "_test" (checked in testDatabaseUrl); quote it anyway.
    await client.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
    return true;
  } finally {
    await client.end();
  }
}

/** `migrate deploy` only applies pending migrations; it never resets anything. */
function migrate(url: string): void {
  try {
    execFileSync(
      resolve(backendRoot, 'node_modules/.bin/prisma'),
      ['migrate', 'deploy'],
      {
        cwd: backendRoot,
        env: { ...process.env, DATABASE_URL: url },
        stdio: 'pipe',
      },
    );
  } catch (error) {
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `e2e: falló "prisma migrate deploy"\n${stdout?.toString() ?? ''}${stderr?.toString() ?? ''}`,
    );
  }
}

async function truncateAllTables(url: string): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
    );
    if (rows.length === 0) return;
    const tables = rows
      .map(({ tablename }) => `"${tablename.replaceAll('"', '""')}"`)
      .join(', ');
    await client.query(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
  } finally {
    await client.end();
  }
}
