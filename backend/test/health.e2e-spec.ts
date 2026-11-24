import type { INestApplication } from '@nestjs/common';
import { api, createTestApp } from './support/app.js';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health is public and reports the database up', async () => {
    const res = await api(app).get('/health').expect(200);

    expect(res.body).toEqual({ status: 'ok', database: 'up' });
  });
});
