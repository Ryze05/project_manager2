import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

/** `backend/`, whatever the process' working directory is. */
export const backendRoot = resolve(import.meta.dirname, '../..');

/** Name of the database in a connection URL (`.../gestor_test?schema=...`). */
export function databaseName(url: string | URL): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

/**
 * URL of the database the e2e tests run against.
 *
 * Never the development one: unless `TEST_DATABASE_URL` is set, it is the
 * `DATABASE_URL` from `.env` with `_test` appended to the database name
 * (`gestor` -> `gestor_test`). Whatever the source, the name MUST end in
 * `_test`, because the e2e setup truncates every table in it.
 */
export function testDatabaseUrl(): string {
  loadEnv({ path: resolve(backendRoot, '.env'), quiet: true });

  const explicit = process.env['TEST_DATABASE_URL'];
  const base = explicit ?? process.env['DATABASE_URL'];
  if (!base) {
    throw new Error(
      'e2e: no hay TEST_DATABASE_URL ni DATABASE_URL (revisa backend/.env).',
    );
  }

  const url = new URL(base);
  const name = databaseName(url);
  if (!explicit && !name.endsWith('_test')) {
    url.pathname = `/${name}_test`;
  }

  if (!databaseName(url).endsWith('_test')) {
    throw new Error(
      `e2e: la base de datos de tests debe terminar en "_test" (es "${databaseName(url)}"). ` +
        'Se vacía por completo en cada ejecución, así que no se usa otra.',
    );
  }
  return url.toString();
}
