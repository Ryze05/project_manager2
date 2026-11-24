import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { api, createTestApp, type TestUser } from './support/app.js';
import { createSubtask, createTask, createTeam } from './support/fixtures.js';

describe('Subtasks (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const taskUrl = (projectId: string, taskId: string) =>
    `/projects/${projectId}/tasks/${taskId}`;
  const get = async (user: TestUser, projectId: string, taskId: string) =>
    (await api(app, user).get(taskUrl(projectId, taskId)).expect(200)).body;
  const setStatus = (
    user: TestUser,
    projectId: string,
    taskId: string,
    status: string,
  ) => api(app, user).patch(taskUrl(projectId, taskId), { status });
  const progress = async (
    user: TestUser,
    projectId: string,
    taskId: string,
  ) => {
    const { done, total } = (await get(user, projectId, taskId))
      .subtaskProgress;
    return `${done}/${total}`;
  };

  /** A parent task with `n` subtasks S1..Sn, all TODO. */
  async function parentWithSubtasks(n: number) {
    const team = await createTeam(app);
    const parent = await createTask(app, team.owner, team.projectId, {
      title: 'Padre',
    });
    const subtasks = [];
    for (let i = 1; i <= n; i++) {
      subtasks.push(
        await createSubtask(app, team.owner, team.projectId, parent.id, {
          title: `S${i}`,
        }),
      );
    }
    return { ...team, parent, subtasks };
  }

  describe('creating and listing', () => {
    it('creates a TODO subtask under the task, with its own assignee', async () => {
      const { owner, member, projectId, parent } = await parentWithSubtasks(0);
      await api(app, owner).patch(taskUrl(projectId, parent.id), {
        assigneeId: owner.id,
      });

      const sub = await createSubtask(app, owner, projectId, parent.id, {
        title: '  S1  ',
        priority: 'HIGH',
        assigneeId: member.id,
      });

      expect(sub).toMatchObject({
        title: 'S1',
        status: 'TODO',
        parentId: parent.id,
        projectId,
        creatorId: owner.id,
        assignee: { id: member.id },
      });
    });

    it('lists the subtasks oldest first, and lets members do it', async () => {
      const { member, projectId, parent } = await parentWithSubtasks(3);

      const res = await api(app, member)
        .get(`${taskUrl(projectId, parent.id)}/subtasks`)
        .expect(200);

      expect(res.body.map((s: { title: string }) => s.title)).toEqual([
        'S1',
        'S2',
        'S3',
      ]);
    });

    it('does not show subtasks as board cards, only as progress on the parent', async () => {
      const { owner, projectId, parent, subtasks } =
        await parentWithSubtasks(3);
      await setStatus(owner, projectId, subtasks[0].id, 'DONE').expect(200);

      const res = await api(app, owner)
        .get(`/projects/${projectId}/board`)
        .expect(200);

      const cards = Object.values<{ title: string }[]>(res.body).flat();
      expect(cards.map((c) => c.title)).toEqual([parent.title]);
      expect(res.body.TODO[0].subtaskProgress).toEqual({ done: 1, total: 3 });
    });

    it('rejects a subtask under a subtask (one level only) and creates nothing', async () => {
      const { owner, projectId, subtasks } = await parentWithSubtasks(1);

      const res = await api(app, owner)
        .post(`${taskUrl(projectId, subtasks[0].id)}/subtasks`, {
          title: 'Nieta',
        })
        .expect(400);

      expect(res.body.message).toBe('Una subtarea no puede tener subtareas');
      expect(
        await prisma.task.count({ where: { parentId: subtasks[0].id } }),
      ).toBe(0);
    });

    it.each([
      ['a blank title', { title: '  ' }],
      ['a status', { title: 'x', status: 'DONE' }],
      ['a parentId in the body', { title: 'x', parentId: crypto.randomUUID() }],
      ['an unknown field', { title: 'x', foo: 1 }],
    ])('rejects %s (400)', async (_label, body) => {
      const { owner, projectId, parent } = await parentWithSubtasks(0);

      await api(app, owner)
        .post(`${taskUrl(projectId, parent.id)}/subtasks`, body)
        .expect(400);
    });

    it('rejects an assignee outside the project (400)', async () => {
      const { owner, outsider, projectId, parent } =
        await parentWithSubtasks(0);

      await api(app, owner)
        .post(`${taskUrl(projectId, parent.id)}/subtasks`, {
          title: 'x',
          assigneeId: outsider.id,
        })
        .expect(400);
    });

    it('answers 404 for a parent that does not exist or is in another project', async () => {
      const { owner, projectId } = await parentWithSubtasks(0);
      const other = await createTeam(app);
      const foreign = await createTask(app, other.owner, other.projectId, {
        title: 'x',
      });

      await api(app, owner)
        .post(`${taskUrl(projectId, crypto.randomUUID())}/subtasks`, {
          title: 'x',
        })
        .expect(404);
      await api(app, owner)
        .post(`${taskUrl(projectId, foreign.id)}/subtasks`, { title: 'x' })
        .expect(404);
      await api(app, owner)
        .get(`${taskUrl(projectId, foreign.id)}/subtasks`)
        .expect(404);
    });

    it('is closed to outsiders and anonymous requests', async () => {
      const { outsider, projectId, parent } = await parentWithSubtasks(0);
      const url = `${taskUrl(projectId, parent.id)}/subtasks`;

      await api(app, outsider).post(url, { title: 'x' }).expect(404);
      await api(app, outsider).get(url).expect(404);
      await api(app).post(url, { title: 'x' }).expect(401);
      await api(app).get(url).expect(401);
    });
  });

  describe('a task cannot be completed while it has pending subtasks', () => {
    it('answers 409 and leaves the task alone, even if one subtask is only in progress', async () => {
      const { owner, projectId, parent, subtasks } =
        await parentWithSubtasks(3);
      await setStatus(owner, projectId, subtasks[0].id, 'DONE').expect(200);
      await setStatus(owner, projectId, subtasks[1].id, 'IN_PROGRESS').expect(
        200,
      );

      const res = await setStatus(owner, projectId, parent.id, 'DONE').expect(
        409,
      );

      expect(res.body.message).toBe(
        'No se puede completar la tarea mientras tenga subtareas pendientes',
      );
      expect((await get(owner, projectId, parent.id)).status).toBe('TODO');
    });

    it('allows other changes while subtasks are pending', async () => {
      const { owner, projectId, parent } = await parentWithSubtasks(2);

      await setStatus(owner, projectId, parent.id, 'IN_PROGRESS').expect(200);
      await api(app, owner)
        .patch(taskUrl(projectId, parent.id), { title: 'Otro título' })
        .expect(200);
    });

    it('completes the parent by itself when its last pending subtask is done', async () => {
      const { owner, projectId, parent, subtasks } =
        await parentWithSubtasks(2);

      await setStatus(owner, projectId, subtasks[0].id, 'DONE').expect(200);
      expect((await get(owner, projectId, parent.id)).status).toBe('TODO');

      await setStatus(owner, projectId, subtasks[1].id, 'DONE').expect(200);
      expect(await progress(owner, projectId, parent.id)).toBe('2/2');
      expect((await get(owner, projectId, parent.id)).status).toBe('DONE');
    });

    it('completes an IN_PROGRESS parent too, and it can still be closed by hand', async () => {
      const { owner, projectId, parent, subtasks } =
        await parentWithSubtasks(1);
      await setStatus(owner, projectId, parent.id, 'IN_PROGRESS').expect(200);

      await setStatus(owner, projectId, subtasks[0].id, 'DONE').expect(200);

      expect((await get(owner, projectId, parent.id)).status).toBe('DONE');
      await setStatus(owner, projectId, parent.id, 'DONE').expect(200);
    });

    it('does not complete the parent while an IN_PROGRESS subtask is left', async () => {
      const { owner, projectId, parent, subtasks } =
        await parentWithSubtasks(2);
      await setStatus(owner, projectId, subtasks[0].id, 'DONE').expect(200);
      await setStatus(owner, projectId, subtasks[1].id, 'IN_PROGRESS').expect(
        200,
      );

      expect((await get(owner, projectId, parent.id)).status).toBe('TODO');
    });

    it('lets a task with no subtasks be completed', async () => {
      const { owner, projectId } = await createTeam(app);
      const task = await createTask(app, owner, projectId, { title: 'Sola' });

      await setStatus(owner, projectId, task.id, 'DONE').expect(200);
    });
  });

  describe('reopening the parent', () => {
    async function doneParent(n = 2) {
      const ctx = await parentWithSubtasks(n);
      for (const sub of ctx.subtasks) {
        await setStatus(ctx.owner, ctx.projectId, sub.id, 'DONE').expect(200);
      }
      await setStatus(ctx.owner, ctx.projectId, ctx.parent.id, 'DONE').expect(
        200,
      );
      return ctx;
    }

    it('reopening a done subtask sends a done parent back to IN_PROGRESS', async () => {
      const { owner, projectId, parent, subtasks } = await doneParent();

      await setStatus(owner, projectId, subtasks[0].id, 'TODO').expect(200);

      expect((await get(owner, projectId, parent.id)).status).toBe(
        'IN_PROGRESS',
      );
      expect(await progress(owner, projectId, parent.id)).toBe('1/2');
      await setStatus(owner, projectId, parent.id, 'DONE').expect(409);
    });

    it('completing the reopened subtask again completes the parent again', async () => {
      const { owner, projectId, parent, subtasks } = await doneParent();
      await setStatus(owner, projectId, subtasks[0].id, 'TODO').expect(200);
      expect((await get(owner, projectId, parent.id)).status).toBe(
        'IN_PROGRESS',
      );

      await setStatus(owner, projectId, subtasks[0].id, 'DONE').expect(200);

      expect((await get(owner, projectId, parent.id)).status).toBe('DONE');
    });

    it('creating a subtask under a done parent sends it back to IN_PROGRESS', async () => {
      const { owner, projectId, parent } = await doneParent();

      await createSubtask(app, owner, projectId, parent.id, { title: 'Nueva' });

      expect((await get(owner, projectId, parent.id)).status).toBe(
        'IN_PROGRESS',
      );
      expect(await progress(owner, projectId, parent.id)).toBe('2/3');
    });

    it('a rejected creation leaves a done parent untouched (all or nothing)', async () => {
      const { owner, outsider, projectId, parent } = await doneParent();

      await api(app, owner)
        .post(`${taskUrl(projectId, parent.id)}/subtasks`, {
          title: 'Nueva',
          assigneeId: outsider.id,
        })
        .expect(400);

      expect((await get(owner, projectId, parent.id)).status).toBe('DONE');
      expect(await progress(owner, projectId, parent.id)).toBe('2/2');
    });

    it('does not touch a parent that is not done', async () => {
      const { owner, projectId, parent, subtasks } =
        await parentWithSubtasks(2);
      await setStatus(owner, projectId, parent.id, 'IN_PROGRESS').expect(200);
      await setStatus(owner, projectId, subtasks[0].id, 'DONE').expect(200);

      await setStatus(owner, projectId, subtasks[0].id, 'TODO').expect(200);

      expect((await get(owner, projectId, parent.id)).status).toBe(
        'IN_PROGRESS',
      );
    });

    it('does not touch the parent when only a done subtask is edited', async () => {
      const { owner, projectId, parent, subtasks } = await doneParent();

      await api(app, owner)
        .patch(taskUrl(projectId, subtasks[0].id), { title: 'Renombrada' })
        .expect(200);

      expect((await get(owner, projectId, parent.id)).status).toBe('DONE');
    });

    it('deleting a subtask never completes or reopens the parent', async () => {
      const { owner, projectId, parent, subtasks } =
        await parentWithSubtasks(2);
      await setStatus(owner, projectId, subtasks[0].id, 'DONE').expect(200);

      await api(app, owner)
        .delete(taskUrl(projectId, subtasks[1].id))
        .expect(204);

      expect(await progress(owner, projectId, parent.id)).toBe('1/1');
      expect((await get(owner, projectId, parent.id)).status).toBe('TODO');
    });
  });

  describe('a subtask keeps its parent', () => {
    it('exposes parentId on the subtask and rejects changing it (400)', async () => {
      const { owner, projectId, parent, subtasks } =
        await parentWithSubtasks(1);
      const other = await createTask(app, owner, projectId, { title: 'Otra' });

      expect((await get(owner, projectId, subtasks[0].id)).parentId).toBe(
        parent.id,
      );
      await api(app, owner)
        .patch(taskUrl(projectId, subtasks[0].id), { parentId: other.id })
        .expect(400);

      expect((await get(owner, projectId, subtasks[0].id)).parentId).toBe(
        parent.id,
      );
    });

    it('cannot turn a task into a subtask (400)', async () => {
      const { owner, projectId, parent } = await parentWithSubtasks(0);
      const other = await createTask(app, owner, projectId, { title: 'Otra' });

      await api(app, owner)
        .patch(taskUrl(projectId, other.id), { parentId: parent.id })
        .expect(400);
    });
  });

  describe('permissions and cascades', () => {
    it('lets a member delete only their own subtask; the owner deletes any', async () => {
      const { owner, member, projectId, parent, subtasks } =
        await parentWithSubtasks(1);
      const mine = await createSubtask(app, member, projectId, parent.id, {
        title: 'Mía',
      });

      await api(app, member)
        .delete(taskUrl(projectId, subtasks[0].id))
        .expect(403);
      await api(app, member).delete(taskUrl(projectId, mine.id)).expect(204);
      await api(app, owner)
        .delete(taskUrl(projectId, subtasks[0].id))
        .expect(204);
    });

    it('deleting the parent deletes its subtasks and their comments', async () => {
      const { owner, projectId, parent, subtasks } =
        await parentWithSubtasks(2);
      const comment = await prisma.comment.create({
        data: { content: 'hola', taskId: subtasks[0].id, authorId: owner.id },
      });

      await api(app, owner).delete(taskUrl(projectId, parent.id)).expect(204);

      expect(await prisma.task.count({ where: { parentId: parent.id } })).toBe(
        0,
      );
      expect(await prisma.comment.count({ where: { id: comment.id } })).toBe(0);
    });
  });
});
