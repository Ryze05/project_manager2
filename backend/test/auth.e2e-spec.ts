import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { api, createTestApp, registerUser } from './support/app.js';

const newCredentials = (name = 'Ana') => ({
  name,
  email: `${name.toLowerCase()}-${crypto.randomUUID()}@example.com`,
  password: 'Password1',
});

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/register', () => {
    it('creates the user and returns a token, never the password', async () => {
      const credentials = newCredentials();

      const res = await api(app)
        .post('/auth/register', credentials)
        .expect(201);

      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body.user).toMatchObject({
        name: 'Ana',
        email: credentials.email,
      });
      expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/);
    });

    it('stores a bcrypt hash, not the plain password', async () => {
      const credentials = newCredentials();
      await api(app).post('/auth/register', credentials).expect(201);

      const stored = await prisma.user.findUnique({
        where: { email: credentials.email },
      });

      expect(stored?.password).not.toBe(credentials.password);
      expect(stored?.password).toMatch(/^\$2[aby]\$/);
    });

    it('trims the name', async () => {
      const res = await api(app)
        .post('/auth/register', { ...newCredentials(), name: '  Ana García  ' })
        .expect(201);

      expect(res.body.user.name).toBe('Ana García');
    });

    it('rejects an email that is already registered, ignoring case (409)', async () => {
      const credentials = newCredentials();
      await api(app).post('/auth/register', credentials).expect(201);

      await api(app)
        .post('/auth/register', {
          ...credentials,
          email: credentials.email.toUpperCase(),
        })
        .expect(409);
    });

    it.each(['abc', 'abcdefgh', 'Abcdefgh', 'abcdefg1'])(
      'rejects the weak password %s (400)',
      async (password) => {
        await api(app)
          .post('/auth/register', { ...newCredentials(), password })
          .expect(400);
      },
    );

    it('explains the uppercase/number rule even for a short password', async () => {
      const res = await api(app)
        .post('/auth/register', { ...newCredentials(), password: 'abc' })
        .expect(400);

      expect(res.body.message).toContain(
        'La contraseña debe tener al menos una mayúscula y un número',
      );
    });

    it('rejects a name made only of spaces (400)', async () => {
      await api(app)
        .post('/auth/register', { ...newCredentials(), name: '   ' })
        .expect(400);
    });

    it('rejects an invalid email (400)', async () => {
      await api(app)
        .post('/auth/register', { ...newCredentials(), email: 'nope' })
        .expect(400);
    });

    it('rejects unknown fields instead of ignoring them (400)', async () => {
      await api(app)
        .post('/auth/register', { ...newCredentials(), role: 'admin' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('returns a token valid for 24 hours and the user without password', async () => {
      const credentials = newCredentials();
      await api(app).post('/auth/register', credentials).expect(201);

      const res = await api(app)
        .post('/auth/login', {
          email: credentials.email,
          password: credentials.password,
        })
        .expect(200);

      const payload = JSON.parse(
        Buffer.from(res.body.accessToken.split('.')[1], 'base64url').toString(),
      );
      expect(payload.exp - payload.iat).toBe(24 * 60 * 60);
      expect(res.body.user.email).toBe(credentials.email);
      expect(JSON.stringify(res.body)).not.toMatch(/password|\$2[aby]\$/);
    });

    it('is case-insensitive on the email', async () => {
      const credentials = newCredentials();
      await api(app).post('/auth/register', credentials).expect(201);

      await api(app)
        .post('/auth/login', {
          email: credentials.email.toUpperCase(),
          password: credentials.password,
        })
        .expect(200);
    });

    it('answers a wrong password and an unknown email with the same 401', async () => {
      const credentials = newCredentials();
      await api(app).post('/auth/register', credentials).expect(201);

      const wrongPassword = await api(app)
        .post('/auth/login', {
          email: credentials.email,
          password: 'Mala12345',
        })
        .expect(401);
      const unknownEmail = await api(app)
        .post('/auth/login', {
          email: `nadie-${crypto.randomUUID()}@example.com`,
          password: 'Mala12345',
        })
        .expect(401);

      expect(wrongPassword.body.message).toBe('Credenciales inválidas');
      expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
    });
  });

  describe('GET /auth/me and the global guard', () => {
    it('returns the authenticated user', async () => {
      const user = await registerUser(app);

      const res = await api(app, user).get('/auth/me').expect(200);

      expect(res.body).toEqual({
        id: user.id,
        name: user.name,
        email: user.email,
      });
    });

    it('rejects a missing, forged or wrongly-schemed token (401)', async () => {
      await api(app).get('/auth/me').expect(401);
      await api(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer abc.def.ghi')
        .expect(401);
      await api(app)
        .get('/auth/me')
        .set('Authorization', 'Basic abc')
        .expect(401);
    });

    it('rejects the token of a user that no longer exists (401)', async () => {
      const user = await registerUser(app);
      await api(app, user).get('/auth/me').expect(200);

      await prisma.user.delete({ where: { id: user.id } });

      await api(app, user).get('/auth/me').expect(401);
    });

    it('protects every non-public route by default', async () => {
      const someId = crypto.randomUUID();

      await api(app).get('/projects').expect(401);
      await api(app).post('/projects', { name: 'x' }).expect(401);
      await api(app).get(`/projects/${someId}/members`).expect(401);
      await api(app).get(`/projects/${someId}/board`).expect(401);
      await api(app).get(`/projects/${someId}/tasks/${someId}`).expect(401);
      await api(app)
        .get(`/projects/${someId}/tasks/${someId}/subtasks`)
        .expect(401);
    });
  });
});
