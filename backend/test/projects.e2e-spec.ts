import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { api, createTestApp, registerUser } from './support/app.js';
import { createSubtask, createTask, createTeam } from './support/fixtures.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Projects (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /projects', () => {
    it('creates the project with its creator as the only OWNER', async () => {
      const owner = await registerUser(app, 'Marta');

      const res = await api(app, owner)
        .post('/projects', { name: '  Gestor  ', description: 'App' })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Gestor',
        description: 'App',
        role: 'OWNER',
        memberCount: 1,
      });
      const members = await prisma.projectMember.findMany({
        where: { projectId: res.body.id },
      });
      expect(members).toEqual([
        expect.objectContaining({ userId: owner.id, role: 'OWNER' }),
      ]);
    });

    it.each([
      ['a blank name', { name: '   ' }],
      ['a name over 100 characters', { name: 'a'.repeat(101) }],
      ['no name', {}],
      ['an unknown field', { name: 'x', foo: 1 }],
    ])('rejects %s (400)', async (_label, body) => {
      const owner = await registerUser(app);

      await api(app, owner).post('/projects', body).expect(400);
    });
  });

  describe('GET /projects', () => {
    it('lists only my projects, most recently updated first', async () => {
      const owner = await registerUser(app, 'Marta');
      const stranger = await registerUser(app, 'Lucia');
      const first = await api(app, owner)
        .post('/projects', { name: 'Primero' })
        .expect(201);
      await sleep(10);
      await api(app, owner).post('/projects', { name: 'Segundo' }).expect(201);

      const before = await api(app, owner).get('/projects').expect(200);
      expect(before.body.map((p: { name: string }) => p.name)).toEqual([
        'Segundo',
        'Primero',
      ]);

      await sleep(10);
      await api(app, owner)
        .patch(`/projects/${first.body.id}`, { name: 'Primero editado' })
        .expect(200);
      const after = await api(app, owner).get('/projects').expect(200);
      expect(after.body.map((p: { name: string }) => p.name)).toEqual([
        'Primero editado',
        'Segundo',
      ]);

      const others = await api(app, stranger).get('/projects').expect(200);
      expect(others.body).toEqual([]);
    });
  });

  describe('GET /projects/:id', () => {
    it('shows each member the project with their own role and the member count', async () => {
      const { owner, member, projectId } = await createTeam(app);

      const asOwner = await api(app, owner)
        .get(`/projects/${projectId}`)
        .expect(200);
      const asMember = await api(app, member)
        .get(`/projects/${projectId}`)
        .expect(200);

      expect(asOwner.body).toMatchObject({ role: 'OWNER', memberCount: 2 });
      expect(asMember.body).toMatchObject({ role: 'MEMBER', memberCount: 2 });
    });

    it('answers 404 to non-members, so the project existence is not revealed', async () => {
      const { outsider, projectId } = await createTeam(app);

      await api(app, outsider).get(`/projects/${projectId}`).expect(404);
      await api(app, outsider)
        .get(`/projects/${crypto.randomUUID()}`)
        .expect(404);
    });

    it('rejects a malformed id (400)', async () => {
      const owner = await registerUser(app);

      await api(app, owner).get('/projects/abc').expect(400);
    });
  });

  describe('PATCH /projects/:id', () => {
    it('lets the owner rename it; an empty body changes nothing', async () => {
      const { owner, projectId } = await createTeam(app);

      const renamed = await api(app, owner)
        .patch(`/projects/${projectId}`, { name: '  Renombrado ' })
        .expect(200);
      expect(renamed.body).toMatchObject({ name: 'Renombrado', role: 'OWNER' });

      const untouched = await api(app, owner)
        .patch(`/projects/${projectId}`, {})
        .expect(200);
      expect(untouched.body.name).toBe('Renombrado');
    });

    it('rejects a blank name and unknown fields (400)', async () => {
      const { owner, projectId } = await createTeam(app);

      await api(app, owner)
        .patch(`/projects/${projectId}`, { name: '  ' })
        .expect(400);
      await api(app, owner)
        .patch(`/projects/${projectId}`, { role: 'x' })
        .expect(400);
    });

    it('is owner-only: a member gets 403, an outsider 404', async () => {
      const { member, outsider, projectId } = await createTeam(app);

      await api(app, member)
        .patch(`/projects/${projectId}`, { name: 'Hack' })
        .expect(403);
      await api(app, outsider)
        .patch(`/projects/${projectId}`, { name: 'Hack' })
        .expect(404);
    });
  });

  describe('DELETE /projects/:id', () => {
    it('is owner-only and leaves the project untouched when refused', async () => {
      const { owner, member, outsider, projectId } = await createTeam(app);

      await api(app, member).delete(`/projects/${projectId}`).expect(403);
      await api(app, outsider).delete(`/projects/${projectId}`).expect(404);

      await api(app, owner).get(`/projects/${projectId}`).expect(200);
    });

    it('deletes everything it contains: members, tasks and subtasks', async () => {
      const { owner, projectId } = await createTeam(app);
      const task = await createTask(app, owner, projectId, { title: 'T' });
      await createSubtask(app, owner, projectId, task.id, { title: 'S' });

      await api(app, owner).delete(`/projects/${projectId}`).expect(204);

      await api(app, owner).get(`/projects/${projectId}`).expect(404);
      expect(await prisma.task.count({ where: { projectId } })).toBe(0);
      expect(await prisma.projectMember.count({ where: { projectId } })).toBe(
        0,
      );
    });
  });
});
