import type { INestApplication } from '@nestjs/common';
import { api, createTestApp } from './support/app.js';
import {
  createComment,
  createSubtask,
  createTask,
  createTeam,
} from './support/fixtures.js';

describe('Archived projects (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  /** A team with a task, a subtask, a comment and a label, then archived. */
  async function archivedTeam() {
    const team = await createTeam(app);
    const p = team.projectId;
    const task = await createTask(app, team.owner, p, { title: 'T' });
    const subtask = await createSubtask(app, team.owner, p, task.id, {
      title: 'S',
    });
    const comment = await createComment(app, team.member, p, task.id, 'hola');
    const label = (
      await api(app, team.owner)
        .post(`/projects/${p}/labels`, { name: 'Bug' })
        .expect(201)
    ).body as { id: string };
    await api(app, team.owner).post(`/projects/${p}/archive`).expect(200);
    return { team, p, task, subtask, comment, label };
  }

  it('only the owner archives and unarchives; outsiders get 404', async () => {
    const team = await createTeam(app);
    const p = team.projectId;
    await api(app, team.member).post(`/projects/${p}/archive`).expect(403);
    await api(app, team.outsider).post(`/projects/${p}/archive`).expect(404);

    const archived = await api(app, team.owner)
      .post(`/projects/${p}/archive`)
      .expect(200);
    expect(archived.body.archivedAt).toEqual(expect.any(String));

    await api(app, team.member).post(`/projects/${p}/unarchive`).expect(403);
    const back = await api(app, team.owner)
      .post(`/projects/${p}/unarchive`)
      .expect(200);
    expect(back.body.archivedAt).toBeNull();
  });

  it('archiving twice keeps the first date', async () => {
    const team = await createTeam(app);
    const p = team.projectId;
    const first = await api(app, team.owner).post(`/projects/${p}/archive`);
    const second = await api(app, team.owner).post(`/projects/${p}/archive`);
    expect(second.status).toBe(200);
    expect(second.body.archivedAt).toBe(first.body.archivedAt);
  });

  it('shows archivedAt in the list and in the detail', async () => {
    const { team, p } = await archivedTeam();
    const list = await api(app, team.member).get('/projects').expect(200);
    const mine = (
      list.body as { id: string; archivedAt: string | null }[]
    ).find((x) => x.id === p);
    expect(mine?.archivedAt).toEqual(expect.any(String));
    const one = await api(app, team.member).get(`/projects/${p}`).expect(200);
    expect(one.body.archivedAt).toEqual(expect.any(String));
  });

  it('keeps everything readable', async () => {
    const { team, p, task, subtask } = await archivedTeam();
    const get = (path: string) =>
      api(app, team.member).get(`/projects/${p}${path}`).expect(200);
    await get('/board');
    await get(`/tasks/${task.id}`);
    await get(`/tasks/${task.id}/subtasks`);
    await get(`/tasks/${subtask.id}`);
    await get(`/tasks/${task.id}/comments`);
    await get('/labels');
    await get('/members');
    await get('/activity');
  });

  it('refuses every write with 409', async () => {
    const { team, p, task, subtask, comment, label } = await archivedTeam();
    const owner = api(app, team.owner);
    const member = api(app, team.member);
    const base = `/projects/${p}`;

    await member.post(`${base}/tasks`, { title: 'X' }).expect(409);
    await member
      .post(`${base}/tasks/${task.id}/subtasks`, { title: 'X' })
      .expect(409);
    await member
      .patch(`${base}/tasks/${task.id}`, { title: 'Nuevo' })
      .expect(409);
    await member
      .patch(`${base}/tasks/${subtask.id}`, { status: 'DONE' })
      .expect(409);
    await member
      .patch(`${base}/tasks/${task.id}/move`, { status: 'IN_PROGRESS' })
      .expect(409);
    await owner.delete(`${base}/tasks/${subtask.id}`).expect(409);
    await owner.delete(`${base}/tasks/${task.id}`).expect(409);

    await member
      .post(`${base}/tasks/${task.id}/comments`, { content: 'x' })
      .expect(409);
    await member
      .patch(`${base}/tasks/${task.id}/comments/${comment.id}`, {
        content: 'editado',
      })
      .expect(409);
    await member
      .delete(`${base}/tasks/${task.id}/comments/${comment.id}`)
      .expect(409);

    await member.post(`${base}/labels`, { name: 'Otra' }).expect(409);
    await owner.patch(`${base}/labels/${label.id}`, { name: 'Z' }).expect(409);
    await owner.delete(`${base}/labels/${label.id}`).expect(409);

    await owner
      .post(`${base}/invitations`, { email: team.outsider.email })
      .expect(409);
    await owner.delete(`${base}/members/${team.member.id}`).expect(409);
    await owner.patch(base, { name: 'Otro' }).expect(409);

    // Nothing changed.
    const board = await member.get(`${base}/board`).expect(200);
    expect(board.body.TODO.map((t: { title: string }) => t.title)).toEqual([
      'T',
    ]);
  });

  it('lets the owner delete an archived project', async () => {
    const { team, p } = await archivedTeam();
    await api(app, team.owner).delete(`/projects/${p}`).expect(204);
  });

  it('works again after unarchiving', async () => {
    const { team, p } = await archivedTeam();
    await api(app, team.owner).post(`/projects/${p}/unarchive`).expect(200);
    await api(app, team.member)
      .post(`/projects/${p}/tasks`, { title: 'Otra vez' })
      .expect(201);
  });

  it('hides tasks of archived projects from "mis tareas"', async () => {
    const team = await createTeam(app);
    const p = team.projectId;
    await createTask(app, team.owner, p, {
      title: 'Mia',
      assigneeId: team.member.id,
    });
    const titles = async () =>
      (
        (await api(app, team.member).get('/me/tasks').expect(200)).body as {
          title: string;
        }[]
      ).map((t) => t.title);

    expect(await titles()).toEqual(['Mia']);
    await api(app, team.owner).post(`/projects/${p}/archive`).expect(200);
    expect(await titles()).toEqual([]);
    await api(app, team.owner).post(`/projects/${p}/unarchive`).expect(200);
    expect(await titles()).toEqual(['Mia']);
  });
});
