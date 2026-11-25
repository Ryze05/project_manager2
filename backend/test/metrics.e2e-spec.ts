import type { INestApplication } from '@nestjs/common';
import { api, createTestApp } from './support/app.js';
import { createSubtask, createTask, createTeam } from './support/fixtures.js';

const day = (offset: number) =>
  new Date(Date.now() + offset * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

describe('Project metrics (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  /** A task created through the API; `status` is not a create field, so it is set after. */
  const makeTask = async (
    team: Awaited<ReturnType<typeof createTeam>>,
    body: { status?: string; [key: string]: unknown },
  ) => {
    const { status, ...fields } = body;
    const task = await createTask(app, team.owner, team.projectId, fields);
    if (status) {
      await api(app, team.owner)
        .patch(`/projects/${team.projectId}/tasks/${task.id}`, { status })
        .expect(200);
    }
    return task;
  };

  const metrics = async (user: Parameters<typeof api>[1], projectId: string) =>
    (await api(app, user).get(`/projects/${projectId}/metrics`).expect(200))
      .body;

  it('is all zeros for an empty project, with every member listed', async () => {
    const team = await createTeam(app);
    const m = await metrics(team.member, team.projectId);
    expect(m.tasks).toEqual({ total: 0, todo: 0, inProgress: 0, done: 0 });
    expect(m).toMatchObject({ overdue: 0, dueSoon: 0, unassigned: 0 });
    expect(m.subtasks).toEqual({ total: 0, done: 0 });
    expect(
      m.byAssignee.map((a: { user: { name: string } }) => a.user.name),
    ).toEqual(['Marta', 'Pablo']);
  });

  it('counts top-level tasks by status and subtasks apart', async () => {
    const team = await createTeam(app);
    const p = team.projectId;
    const mk = (body: { status?: string; [key: string]: unknown }) =>
      makeTask(team, body);
    const a = await mk({ title: 'A' });
    await mk({ title: 'B', status: 'IN_PROGRESS' });
    await mk({ title: 'C', status: 'DONE' });
    const s1 = await createSubtask(app, team.owner, p, a.id, { title: 's1' });
    await createSubtask(app, team.owner, p, a.id, { title: 's2' });
    await api(app, team.owner)
      .patch(`/projects/${p}/tasks/${s1.id}`, { status: 'DONE' })
      .expect(200);

    const m = await metrics(team.owner, p);
    expect(m.tasks).toEqual({ total: 3, todo: 1, inProgress: 1, done: 1 });
    expect(m.subtasks).toEqual({ total: 2, done: 1 });
  });

  it('counts overdue and due soon only for tasks that are not done', async () => {
    const team = await createTeam(app);
    const p = team.projectId;
    const mk = (body: { status?: string; [key: string]: unknown }) =>
      makeTask(team, body);
    await mk({ title: 'vencida', dueDate: day(-3) });
    await mk({ title: 'vencida hecha', dueDate: day(-3), status: 'DONE' });
    await mk({ title: 'hoy', dueDate: day(0) });
    await mk({ title: 'en 7 dias', dueDate: day(7) });
    await mk({ title: 'en 8 dias', dueDate: day(8) });
    await mk({ title: 'sin fecha' });
    await mk({ title: 'proxima hecha', dueDate: day(2), status: 'DONE' });

    const m = await metrics(team.owner, p);
    expect(m.overdue).toBe(1);
    expect(m.dueSoon).toBe(2);
  });

  it('splits by responsible, counts unassigned, and sorts by pending work', async () => {
    const team = await createTeam(app);
    const p = team.projectId;
    const mk = (body: { status?: string; [key: string]: unknown }) =>
      makeTask(team, body);
    await mk({ title: '1', assigneeId: team.member.id });
    await mk({ title: '2', assigneeId: team.member.id, status: 'IN_PROGRESS' });
    await mk({ title: '3', assigneeId: team.member.id, status: 'DONE' });
    await mk({ title: '4', assigneeId: team.owner.id });
    await mk({ title: '5' });
    await mk({ title: '6', status: 'DONE' });

    const m = await metrics(team.owner, p);
    expect(m.unassigned).toBe(1);
    expect(m.byAssignee).toEqual([
      {
        user: { id: team.member.id, name: 'Pablo' },
        todo: 1,
        inProgress: 1,
        done: 1,
      },
      {
        user: { id: team.owner.id, name: 'Marta' },
        todo: 1,
        inProgress: 0,
        done: 0,
      },
    ]);
  });

  it('a removed member leaves the breakdown and their tasks count as unassigned', async () => {
    const team = await createTeam(app);
    await createTask(app, team.owner, team.projectId, {
      title: 'T',
      assigneeId: team.member.id,
    });
    await api(app, team.owner)
      .delete(`/projects/${team.projectId}/members/${team.member.id}`)
      .expect(204);
    const m = await metrics(team.owner, team.projectId);
    expect(m.byAssignee).toHaveLength(1);
    expect(m.unassigned).toBe(1);
  });

  it('is visible to any member and to archived projects, never to outsiders', async () => {
    const team = await createTeam(app);
    await api(app, team.outsider)
      .get(`/projects/${team.projectId}/metrics`)
      .expect(404);
    await api(app, team.owner)
      .post(`/projects/${team.projectId}/archive`)
      .expect(200);
    await metrics(team.member, team.projectId);
  });

  it("does not mix in another project's tasks", async () => {
    const a = await createTeam(app);
    const b = await createTeam(app);
    await createTask(app, b.owner, b.projectId, { title: 'Ajena' });
    const m = await metrics(a.owner, a.projectId);
    expect(m.tasks.total).toBe(0);
  });
});
