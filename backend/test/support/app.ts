import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';

/** The real AppModule with the same global setup as `main.ts` (no Swagger, no listen). */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

export interface TestUser {
  id: string;
  name: string;
  email: string;
  token: string;
}

/** Registers a user with a unique email, so tests never collide with each other. */
export async function registerUser(
  app: INestApplication,
  name = 'Test',
): Promise<TestUser> {
  const email = `${name.toLowerCase()}-${crypto.randomUUID()}@example.com`;
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ name, email, password: 'Password1' })
    .expect(201);
  return {
    id: res.body.user.id as string,
    name,
    email,
    token: res.body.accessToken as string,
  };
}

/**
 * Tiny HTTP client: `api(app, user).get('/projects')`. Paths are relative to
 * `/api/v1`; with a user it sends their Bearer token, without one it sends none.
 */
export function api(app: INestApplication, user?: TestUser) {
  const server = app.getHttpServer();
  const auth = <T extends { set(name: string, value: string): T }>(
    req: T,
  ): T => (user ? req.set('Authorization', `Bearer ${user.token}`) : req);
  const url = (path: string) => `/api/v1${path}`;

  return {
    get: (path: string) => auth(request(server).get(url(path))),
    post: (path: string, body?: object) =>
      auth(request(server).post(url(path)).send(body)),
    patch: (path: string, body?: object) =>
      auth(request(server).patch(url(path)).send(body)),
    delete: (path: string) => auth(request(server).delete(url(path))),
  };
}
