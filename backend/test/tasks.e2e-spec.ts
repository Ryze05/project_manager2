import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { api, createTestApp, type TestUser } from './support/app.js';
import { createTask, createTeam } from './support/fixtures.js';

describe('Tasks and board (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const titles = (cards: { title: string }[]) => cards.map((c) => c.title);
  const board = async (user: TestUser, projectId: string) =>
    (await api(app, user).get(`/projects/${projectId}/board`).expect(200)).body;

  describe('POST /projects/:projectId/tasks', () => {
    it('creates a TODO task with sensible defaults', async () => {
      const { owner, projectId } = await createTeam(app);

      const task = await createTask(app, owner, projectId, { title: '  T1  ' });

      expect(task).toMatchObject({
        title: 'T1',
        status: 'TODO',
        priority: 'MEDIUM',
        description: null,
        dueDate: null,
        assignee: null,
        parentId: null,
        creatorId: owner.id,
        projectId,
        subtaskProgress: { done: 0, total: 0 },
      });
      expect(task).not.toHaveProperty('assigneeId');
      expect(task).not.toHaveProperty('subtasks');
    });

    it('stores every optional field, with the assignee as a small object', async () => {
      const { owner, member, projectId } = await createTeam(app);

      const task = await createTask(app, owner, projectId, {
        title: 'Completa',
        description: 'desc',
        priority: 'HIGH',
        dueDate: '2026-12-20',
        assigneeId: member.id,
      });

      expect(task).toMatchObject({
        description: 'desc',
        priority: 'HIGH',
        assignee: { id: member.id, name: member.name, email: member.email },
      });
      expect(String(task.dueDate)).toMatch(/^2026-12-20/);
    });

    it.each([
      ['a blank title', { title: '   ' }],
      ['a null title', { title: null }],
      ['no title', {}],
      ['a title over 200 characters', { title: 'a'.repeat(201) }],
      ['an unknown priority', { title: 'x', priority: 'URGENT' }],
      ['a null priority', { title: 'x', priority: null }],
      ['an invalid date', { title: 'x', dueDate: 'mañana' }],
      [
        'a status (new tasks always start TODO)',
        { title: 'x', status: 'DONE' },
      ],
      ['a parentId', { title: 'x', parentId: crypto.randomUUID() }],
      ['an assigneeId that is not a UUID', { title: 'x', assigneeId: 'pablo' }],
      ['an unknown field', { title: 'x', foo: 1 }],
    ])('rejects %s (400) and creates nothing', async (_label, body) => {
      const { owner, projectId } = await createTeam(app);

      await api(app, owner)
        .post(`/projects/${projectId}/tasks`, body)
        .expect(400);

      expect(await prisma.task.count({ where: { projectId } })).toBe(0);
    });

    it('rejects an assignee who is not in the project (400)', async () => {
      const { owner, outsider, projectId } = await createTeam(app);

      const res = await api(app, owner)
        .post(`/projects/${projectId}/tasks`, {
          title: 'x',
          assigneeId: outsider.id,
        })
        .expect(400);

      expect(res.body.message).toBe(
        'El responsable debe ser miembro del proyecto',
      );
    });

    it('is closed to outsiders (404) and to anonymous requests (401)', async () => {
      const { outsider, projectId } = await createTeam(app);

      await api(app, outsider)
        .post(`/projects/${projectId}/tasks`, { title: 'x' })
        .expect(404);
      await api(app)
        .post(`/projects/${projectId}/tasks`, { title: 'x' })
        .expect(401);
    });
  });

  describe('GET /projects/:projectId/board', () => {
    it('returns the three columns even when empty', async () => {
      const { owner, projectId } = await createTeam(app);

      expect(await board(owner, projectId)).toEqual({
        TODO: [],
        IN_PROGRESS: [],
        DONE: [],
      });
    });

    it('orders each column by priority, then due date (none last), then age', async () => {
      const { owner, member, projectId } = await createTeam(app);
      const make = (body: object, user = owner) =>
        createTask(app, user, projectId, body);
      await make({ title: 'A', priority: 'HIGH', dueDate: '2026-12-20' });
      await make({ title: 'B', priority: 'HIGH', dueDate: '2026-12-10' });
      await make({ title: 'C', priority: 'HIGH' });
      await make({ title: 'D', priority: 'LOW', dueDate: '2026-12-01' });
      await make({ title: 'E', dueDate: '2026-12-05' });
      await make({ title: 'F' });
      await make({ title: 'G' }, member);

      const { TODO } = await board(owner, projectId);

      expect(titles(TODO)).toEqual(['B', 'A', 'C', 'E', 'F', 'G', 'D']);
    });

    it('shows each task in the column of its status', async () => {
      const { owner, projectId } = await createTeam(app);
      const todo = await createTask(app, owner, projectId, { title: 'todo' });
      const doing = await createTask(app, owner, projectId, { title: 'doing' });
      const done = await createTask(app, owner, projectId, { title: 'done' });
      const move = (id: string, status: string) =>
        api(app, owner)
          .patch(`/projects/${projectId}/tasks/${id}`, { status })
          .expect(200);
      await move(doing.id, 'IN_PROGRESS');
      await move(done.id, 'DONE');

      const columns = await board(owner, projectId);

      expect(titles(columns.TODO)).toEqual([todo.title]);
      expect(titles(columns.IN_PROGRESS)).toEqual(['doing']);
      expect(titles(columns.DONE)).toEqual(['done']);
    });

    it('is closed to outsiders', async () => {
      const { outsider, projectId } = await createTeam(app);

      await api(app, outsider).get(`/projects/${projectId}/board`).expect(404);
    });
  });

  describe('GET and PATCH /projects/:projectId/tasks/:taskId', () => {
    it('moves a task between columns and leaves omitted fields alone', async () => {
      const { owner, projectId } = await createTeam(app);
      const task = await createTask(app, owner, projectId, {
        title: 'Mover',
        priority: 'HIGH',
      });

      const res = await api(app, owner)
        .patch(`/projects/${projectId}/tasks/${task.id}`, {
          status: 'IN_PROGRESS',
        })
        .expect(200);

      expect(res.body).toMatchObject({
        status: 'IN_PROGRESS',
        title: 'Mover',
        priority: 'HIGH',
      });
    });

    it('an empty body changes nothing; the title is trimmed', async () => {
      const { owner, projectId } = await createTeam(app);
      const task = await createTask(app, owner, projectId, { title: 'Igual' });
      const url = `/projects/${projectId}/tasks/${task.id}`;

      const same = await api(app, owner).patch(url, {}).expect(200);
      expect(same.body.title).toBe('Igual');

      const renamed = await api(app, owner)
        .patch(url, { title: '  Nuevo ' })
        .expect(200);
      expect(renamed.body.title).toBe('Nuevo');
    });

    it('clears description, due date and assignee with null', async () => {
      const { owner, member, projectId } = await createTeam(app);
      const task = await createTask(app, owner, projectId, {
        title: 'Limpiar',
        description: 'algo',
        dueDate: '2026-12-31',
        assigneeId: member.id,
      });

      const res = await api(app, owner)
        .patch(`/projects/${projectId}/tasks/${task.id}`, {
          description: null,
          dueDate: null,
          assigneeId: null,
        })
        .expect(200);

      expect(res.body).toMatchObject({
        description: null,
        dueDate: null,
        assignee: null,
      });
    });

    it.each([
      ['a null title', { title: null }],
      ['a null priority', { priority: null }],
      ['a null status', { status: null }],
      ['a blank title', { title: '  ' }],
      ['an unknown status', { status: 'BLOCKED' }],
      [
        'a parentId (a task cannot become a subtask)',
        { parentId: crypto.randomUUID() },
      ],
      ['an unknown field', { foo: 1 }],
    ])('rejects %s (400)', async (_label, body) => {
      const { owner, projectId } = await createTeam(app);
      const task = await createTask(app, owner, projectId, { title: 'x' });

      await api(app, owner)
        .patch(`/projects/${projectId}/tasks/${task.id}`, body)
        .expect(400);
    });

    it('rejects reassigning to someone outside the project (400)', async () => {
      const { owner, outsider, projectId } = await createTeam(app);
      const task = await createTask(app, owner, projectId, { title: 'x' });

      await api(app, owner)
        .patch(`/projects/${projectId}/tasks/${task.id}`, {
          assigneeId: outsider.id,
        })
        .expect(400);
    });

    it('lets any member edit a task someone else created', async () => {
      const { owner, member, projectId } = await createTeam(app);
      const task = await createTask(app, owner, projectId, { title: 'x' });

      await api(app, member)
        .patch(`/projects/${projectId}/tasks/${task.id}`, { priority: 'LOW' })
        .expect(200);
    });

    it('treats a task id from another project as not found', async () => {
      const team = await createTeam(app);
      const other = await createTeam(app);
      const task = await createTask(app, team.owner, team.projectId, {
        title: 'x',
      });
      const via = `/projects/${other.projectId}/tasks/${task.id}`;

      await api(app, other.owner).get(via).expect(404);
      await api(app, other.owner).patch(via, { title: 'y' }).expect(404);
      await api(app, other.owner).delete(via).expect(404);
    });

    it('is closed to outsiders; malformed ids are 400, unknown ids 404', async () => {
      const { owner, outsider, projectId } = await createTeam(app);
      const task = await createTask(app, owner, projectId, { title: 'x' });
      const url = `/projects/${projectId}/tasks/${task.id}`;

      await api(app, outsider).get(url).expect(404);
      await api(app, outsider).patch(url, { title: 'y' }).expect(404);
      await api(app, outsider).delete(url).expect(404);
      await api(app, owner).get(`/projects/${projectId}/tasks/abc`).expect(400);
      await api(app, owner)
        .get(`/projects/${projectId}/tasks/${crypto.randomUUID()}`)
        .expect(404);
    });
  });

  describe('DELETE /projects/:projectId/tasks/:taskId', () => {
    it('lets the owner delete any task and a member only their own', async () => {
      const { owner, member, projectId } = await createTeam(app);
      const byOwner = await createTask(app, owner, projectId, {
        title: 'de Marta',
      });
      const byMember = await createTask(app, member, projectId, {
        title: 'de Pablo',
      });

      const refused = await api(app, member)
        .delete(`/projects/${projectId}/tasks/${byOwner.id}`)
        .expect(403);
      expect(refused.body.message).toBe(
        'Solo puedes borrar las tareas que has creado',
      );
      await api(app, owner)
        .get(`/projects/${projectId}/tasks/${byOwner.id}`)
        .expect(200);

      await api(app, member)
        .delete(`/projects/${projectId}/tasks/${byMember.id}`)
        .expect(204);
      await api(app, owner)
        .delete(`/projects/${projectId}/tasks/${byOwner.id}`)
        .expect(204);
      await api(app, owner)
        .delete(`/projects/${projectId}/tasks/${byOwner.id}`)
        .expect(404);
    });

    it("lets the owner delete a member's task", async () => {
      const { owner, member, projectId } = await createTeam(app);
      const task = await createTask(app, member, projectId, {
        title: 'de Pablo',
      });

      await api(app, owner)
        .delete(`/projects/${projectId}/tasks/${task.id}`)
        .expect(204);
    });
  });
});
