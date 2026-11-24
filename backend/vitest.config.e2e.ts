import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './test/support/test-database.js';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // Creates/migrates/empties the "_test" database once before everything.
    globalSetup: ['./test/global-setup.ts'],
    // One database shared by all files: run them one after another.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 60_000,
    // The app under test reads these (they win over backend/.env), so the e2e
    // run never touches the development database nor needs real secrets.
    env: {
      NODE_ENV: 'test',
      FRONTEND_URL: 'http://localhost:3001',
      DATABASE_URL: testDatabaseUrl(),
      JWT_SECRET: 'e2e-only-secret-e2e-only-secret-e2e-only-secret',
      JWT_EXPIRES_IN: '24h',
    },
  },
});
