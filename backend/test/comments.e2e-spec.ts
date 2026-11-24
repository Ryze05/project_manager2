import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { api, createTestApp } from './support/app.js';
import {
  createComment,
  createSubtask,
  createTask,
  createTeam,
} from './support/fixtures.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Comments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const commentsUrl = (projectId: string, taskId: string) =>
    `/projects/${projectId}/tasks/${taskId}/comments`;

  /** A team plus one task (created by the owner) to comment on. */
  async function teamWithTask() {
    const team = await createTeam(app);
    const task = await createTask(app, team.owner, team.projectId, {
      title: 'Tarea',
    });
    return { ...team, task, url: commentsUrl(team.projectId, task.id) };
  }

  describe('POST .../comments', () => {
    it('lets the owner and any member comment, showing the author', async () => {
      const { owner, member, task, projectId, url } = await teamWithTask();

      const byMember = await api(app, member)
        .post(url, { content: '  Una duda  ' })
        .expect(201);
      const byOwner = await api(app, owner)
        .post(url, { content: 'Te respondo' })
        .expect(201);

      expect(byMember.body).toMatchObject({
        content: 'Una duda',
        editedAt: null,
        taskId: task.id,
        author: { id: member.id, name: member.name, email: member.email },
      });
      expect(byOwner.body.author.id).toBe(owner.id);
      expect(byMember.body).not.toHaveProperty('authorId');
      expect(await prisma.comment.count({ where: { taskId: task.id } })).toBe(
        2,
      );
      expect(projectId).toBeDefined();
    });

    it('works on subtasks too', async () => {
      const { owner, task, projectId } = await teamWithTask();
      const sub = await createSubtask(app, owner, projectId, task.id, {
        title: 'Sub',
      });

      const res = await api(app, owner)
        .post(commentsUrl(projectId, sub.id), { content: 'En la subtarea' })
        .expect(201);

      expect(res.body.taskId).toBe(sub.id);
    });

    it.each([
      ['blank content', { content: '   ' }],
      ['content over 2000 characters', { content: 'a'.repeat(2001) }],
      ['no content', {}],
      ['null content', { content: null }],
      ['an unknown field', { content: 'x', authorId: crypto.randomUUID() }],
    ])('rejects %s (400) and creates nothing', async (_label, body) => {
      const { owner, task, url } = await teamWithTask();

      await api(app, owner).post(url, body).expect(400);

      expect(await prisma.comment.count({ where: { taskId: task.id } })).toBe(
        0,
      );
    });

    it('accepts exactly 2000 characters', async () => {
      const { owner, url } = await teamWithTask();

      await api(app, owner)
        .post(url, { content: 'a'.repeat(2000) })
        .expect(201);
    });

    it('is closed to outsiders (404) and anonymous requests (401)', async () => {
      const { outsider, url } = await teamWithTask();

      await api(app, outsider).post(url, { content: 'x' }).expect(404);
      await api(app).post(url, { content: 'x' }).expect(401);
    });

    it('404s for a task in another project or that does not exist; 400 for malformed ids', async () => {
      const { owner, projectId } = await teamWithTask();
      const other = await createTeam(app);
      const foreign = await createTask(app, other.owner, other.projectId, {
        title: 'x',
      });

      await api(app, owner)
        .post(commentsUrl(projectId, foreign.id), { content: 'x' })
        .expect(404);
      await api(app, owner)
        .post(commentsUrl(projectId, crypto.randomUUID()), { content: 'x' })
        .expect(404);
      await api(app, owner)
        .post(`/projects/${projectId}/tasks/abc/comments`, { content: 'x' })
        .expect(400);
    });
  });

  describe('GET .../comments', () => {
    it('returns an empty thread for a task without comments', async () => {
      const { owner, url } = await teamWithTask();

      const res = await api(app, owner).get(url).expect(200);

      expect(res.body).toEqual([]);
    });

    it('returns the thread oldest first, only for that task', async () => {
      const { owner, member, task, projectId, url } = await teamWithTask();
      const otherTask = await createTask(app, owner, projectId, {
        title: 'Otra',
      });
      await createComment(app, owner, projectId, task.id, 'primero');
      await sleep(10);
      await createComment(app, member, projectId, task.id, 'segundo');
      await sleep(10);
      await createComment(app, owner, projectId, task.id, 'tercero');
      await createComment(app, owner, projectId, otherTask.id, 'de otra tarea');

      const res = await api(app, member).get(url).expect(200);

      expect(res.body.map((c: { content: string }) => c.content)).toEqual([
        'primero',
        'segundo',
        'tercero',
      ]);
    });

    it('is closed to outsiders (404)', async () => {
      const { outsider, url } = await teamWithTask();

      await api(app, outsider).get(url).expect(404);
    });
  });

  describe('PATCH .../comments/:commentId', () => {
    it('lets the author edit; editedAt is set and createdAt is kept', async () => {
      const { member, task, projectId, url } = await teamWithTask();
      const comment = await createComment(
        app,
        member,
        projectId,
        task.id,
        'Antes',
      );
      expect(comment.editedAt).toBeNull();
      await sleep(10);

      const res = await api(app, member)
        .patch(`${url}/${comment.id}`, { content: '  Después ' })
        .expect(200);

      expect(res.body.content).toBe('Después');
      expect(res.body.createdAt).toBe(comment.createdAt);
      expect(res.body.editedAt).not.toBeNull();
      expect(new Date(res.body.editedAt).getTime()).toBeGreaterThan(
        new Date(comment.createdAt).getTime(),
      );
    });

    it("forbids editing someone else's comment, even for the owner (403)", async () => {
      const { owner, member, task, projectId, url } = await teamWithTask();
      const byMember = await createComment(
        app,
        member,
        projectId,
        task.id,
        'de Pablo',
      );
      const byOwner = await createComment(
        app,
        owner,
        projectId,
        task.id,
        'de Marta',
      );

      const ownerEditsMember = await api(app, owner)
        .patch(`${url}/${byMember.id}`, { content: 'manipulado' })
        .expect(403);
      await api(app, member)
        .patch(`${url}/${byOwner.id}`, { content: 'manipulado' })
        .expect(403);

      expect(ownerEditsMember.body.message).toBe(
        'Solo el autor puede editar su comentario',
      );
      const thread = await api(app, owner).get(url).expect(200);
      expect(thread.body.map((c: { content: string }) => c.content)).toEqual([
        'de Pablo',
        'de Marta',
      ]);
      expect(
        thread.body.every((c: { editedAt: unknown }) => c.editedAt === null),
      ).toBe(true);
    });

    it.each([
      ['blank content', { content: '  ' }],
      ['no content', {}],
      ['null content', { content: null }],
      ['an unknown field', { content: 'x', taskId: crypto.randomUUID() }],
    ])('rejects %s (400)', async (_label, body) => {
      const { member, task, projectId, url } = await teamWithTask();
      const comment = await createComment(
        app,
        member,
        projectId,
        task.id,
        'Texto',
      );

      await api(app, member).patch(`${url}/${comment.id}`, body).expect(400);
    });

    it('404s for a comment of another task, another project, or a malformed id', async () => {
      const { member, task, projectId, url } = await teamWithTask();
      const otherTask = await createTask(app, member, projectId, {
        title: 'Otra',
      });
      const comment = await createComment(
        app,
        member,
        projectId,
        task.id,
        'Texto',
      );
      const other = await createTeam(app);

      await api(app, member)
        .patch(`${commentsUrl(projectId, otherTask.id)}/${comment.id}`, {
          content: 'x',
        })
        .expect(404);
      await api(app, other.owner)
        .patch(`${commentsUrl(other.projectId, task.id)}/${comment.id}`, {
          content: 'x',
        })
        .expect(404);
      await api(app, member)
        .patch(`${url}/${crypto.randomUUID()}`, { content: 'x' })
        .expect(404);
      await api(app, member).patch(`${url}/abc`, { content: 'x' }).expect(400);
    });

    it('is closed to outsiders (404)', async () => {
      const { owner, outsider, task, projectId, url } = await teamWithTask();
      const comment = await createComment(
        app,
        owner,
        projectId,
        task.id,
        'Texto',
      );

      await api(app, outsider)
        .patch(`${url}/${comment.id}`, { content: 'x' })
        .expect(404);
    });
  });

  describe('DELETE .../comments/:commentId', () => {
    it('lets the author delete their own comment', async () => {
      const { member, task, projectId, url } = await teamWithTask();
      const comment = await createComment(
        app,
        member,
        projectId,
        task.id,
        'Mío',
      );

      await api(app, member).delete(`${url}/${comment.id}`).expect(204);

      const thread = await api(app, member).get(url).expect(200);
      expect(thread.body).toEqual([]);
    });

    it("forbids a member from deleting someone else's comment (403)", async () => {
      const { owner, member, task, projectId, url } = await teamWithTask();
      const comment = await createComment(
        app,
        owner,
        projectId,
        task.id,
        'De Marta',
      );

      const res = await api(app, member)
        .delete(`${url}/${comment.id}`)
        .expect(403);

      expect(res.body.message).toBe(
        'Solo puedes borrar tus propios comentarios',
      );
      const thread = await api(app, owner).get(url).expect(200);
      expect(thread.body).toHaveLength(1);
    });

    it("lets the owner delete a member's comment", async () => {
      const { owner, member, task, projectId, url } = await teamWithTask();
      const comment = await createComment(
        app,
        member,
        projectId,
        task.id,
        'De Pablo',
      );

      await api(app, owner).delete(`${url}/${comment.id}`).expect(204);
      await api(app, owner).delete(`${url}/${comment.id}`).expect(404);
    });

    it('is closed to outsiders (404) and anonymous requests (401)', async () => {
      const { owner, outsider, task, projectId, url } = await teamWithTask();
      const comment = await createComment(
        app,
        owner,
        projectId,
        task.id,
        'Texto',
      );

      await api(app, outsider).delete(`${url}/${comment.id}`).expect(404);
      await api(app).delete(`${url}/${comment.id}`).expect(401);
    });
  });

  describe('lifecycle', () => {
    it('deleting a task deletes its comments; deleting a project too', async () => {
      const { owner, member, task, projectId } = await teamWithTask();
      const other = await createTask(app, owner, projectId, { title: 'Otra' });
      await createComment(app, owner, projectId, task.id, 'a');
      await createComment(app, member, projectId, task.id, 'b');
      await createComment(app, owner, projectId, other.id, 'c');

      await api(app, owner)
        .delete(`/projects/${projectId}/tasks/${task.id}`)
        .expect(204);
      expect(await prisma.comment.count({ where: { taskId: task.id } })).toBe(
        0,
      );
      expect(await prisma.comment.count({ where: { taskId: other.id } })).toBe(
        1,
      );

      await api(app, owner).delete(`/projects/${projectId}`).expect(204);
      expect(await prisma.comment.count({ where: { taskId: other.id } })).toBe(
        0,
      );
    });

    it('keeps the comments of a removed member, who can no longer read the thread', async () => {
      const { owner, member, task, projectId, url } = await teamWithTask();
      await createComment(app, member, projectId, task.id, 'Antes de irme');

      await api(app, owner)
        .delete(`/projects/${projectId}/members/${member.id}`)
        .expect(204);

      const thread = await api(app, owner).get(url).expect(200);
      expect(thread.body).toHaveLength(1);
      expect(thread.body[0]).toMatchObject({
        content: 'Antes de irme',
        author: { id: member.id, name: member.name },
      });
      await api(app, member).get(url).expect(404);
      await api(app, member).post(url, { content: 'x' }).expect(404);
    });
  });
});
