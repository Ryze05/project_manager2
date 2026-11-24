import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { api, createTestApp, registerUser } from './support/app.js';
import { createSubtask, createTask, createTeam } from './support/fixtures.js';

describe('My tasks (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const titles = (items: { title: string }[]) => items.map((i) => i.title);
  const mine = async (user: Parameters<typeof api>[1], query = '') =>
    (await api(app, user).get(`/me/tasks${query}`).expect(200)).body;
  const setStatus = (
    user: Parameters<typeof api>[1],
    projectId: string,
    taskId: string,
    status: string,
  ) =>
    api(app, user)
      .patch(`/projects/${projectId}/tasks/${taskId}`, { status })
      .expect(200);

  it('is empty for a user with nothing assigned, and needs a token', async () => {
    const user = await registerUser(app, 'Solo');

    expect(await mine(user)).toEqual([]);
    await api(app).get('/me/tasks').expect(401);
  });

  it('lists what is assigned to me across all my projects, with the project', async () => {
    const a = await createTeam(app);
    const b = await createTeam(app);
    const me = a.member;
    await api(app, b.owner)
      .post(`/projects/${b.projectId}/members`, { email: me.email })
      .expect(201);
    await createTask(app, a.owner, a.projectId, {
      title: 'En A',
      assigneeId: me.id,
    });
    await createTask(app, b.owner, b.projectId, {
      title: 'En B',
      assigneeId: me.id,
    });

    const list = await mine(me);

    expect(titles(list).sort()).toEqual(['En A', 'En B']);
    const inA = list.find((t: { title: string }) => t.title === 'En A');
    expect(inA).toMatchObject({
      projectId: a.projectId,
      project: { id: a.projectId, name: 'Proyecto' },
      parent: null,
      assignee: { id: me.id },
    });
  });

  it("does not show other people's tasks nor unassigned ones", async () => {
    const { owner, member, projectId } = await createTeam(app);
    await createTask(app, owner, projectId, {
      title: 'De Marta',
      assigneeId: owner.id,
    });
    await createTask(app, owner, projectId, { title: 'Sin responsable' });
    await createTask(app, owner, projectId, {
      title: 'De Pablo',
      assigneeId: member.id,
    });

    expect(titles(await mine(member))).toEqual(['De Pablo']);
    expect(titles(await mine(owner))).toEqual(['De Marta']);
  });

  it('shows subtasks with their parent task and the project', async () => {
    const { owner, member, projectId } = await createTeam(app);
    const parent = await createTask(app, owner, projectId, {
      title: 'Padre',
    });
    await createSubtask(app, owner, projectId, parent.id, {
      title: 'Hija',
      assigneeId: member.id,
    });

    const [item] = await mine(member);

    expect(item).toMatchObject({
      title: 'Hija',
      parentId: parent.id,
      parent: { id: parent.id, title: 'Padre' },
      project: { id: projectId, name: 'Proyecto' },
    });
  });

  it('hides done tasks by default; includeDone=true shows them, =false hides them', async () => {
    const { owner, member, projectId } = await createTeam(app);
    const todo = { title: 'Pendiente', assigneeId: member.id };
    await createTask(app, owner, projectId, todo);
    const doing = await createTask(app, owner, projectId, {
      title: 'En curso',
      assigneeId: member.id,
    });
    const done = await createTask(app, owner, projectId, {
      title: 'Hecha',
      assigneeId: member.id,
    });
    await setStatus(owner, projectId, doing.id, 'IN_PROGRESS');
    await setStatus(owner, projectId, done.id, 'DONE');

    expect(titles(await mine(member)).sort()).toEqual([
      'En curso',
      'Pendiente',
    ]);
    expect(titles(await mine(member, '?includeDone=false')).sort()).toEqual([
      'En curso',
      'Pendiente',
    ]);
    expect(titles(await mine(member, '?includeDone=true')).sort()).toEqual([
      'En curso',
      'Hecha',
      'Pendiente',
    ]);
  });

  it('rejects an invalid includeDone and unknown parameters (400)', async () => {
    const user = await registerUser(app, 'Ana');

    await api(app, user).get('/me/tasks?includeDone=yes').expect(400);
    await api(app, user).get('/me/tasks?includeDone=').expect(400);
    await api(app, user).get('/me/tasks?foo=1').expect(400);
  });

  it('orders by due date (none last), then priority, then age', async () => {
    const { owner, member, projectId } = await createTeam(app);
    const make = (body: object) =>
      createTask(app, owner, projectId, { assigneeId: member.id, ...body });
    await make({ title: 'F', priority: 'HIGH' });
    await make({ title: 'A', dueDate: '2026-12-20' });
    await make({ title: 'B', dueDate: '2026-12-10', priority: 'LOW' });
    await make({ title: 'C', dueDate: '2026-12-10', priority: 'HIGH' });
    await make({ title: 'D', dueDate: '2026-12-10', priority: 'HIGH' });
    await make({ title: 'G' });

    expect(titles(await mine(member))).toEqual(['C', 'D', 'B', 'A', 'F', 'G']);
  });

  it('stops showing the tasks of a project I was removed from', async () => {
    const { owner, member, projectId } = await createTeam(app);
    await createTask(app, owner, projectId, {
      title: 'Mía',
      assigneeId: member.id,
    });
    expect(titles(await mine(member))).toEqual(['Mía']);

    await api(app, owner)
      .delete(`/projects/${projectId}/members/${member.id}`)
      .expect(204);

    expect(await mine(member)).toEqual([]);
    expect(await mine(member, '?includeDone=true')).toEqual([]);
  });

  it('hides tasks of a project I no longer belong to even if still assigned (defence in depth)', async () => {
    const { owner, member, projectId } = await createTeam(app);
    await createTask(app, owner, projectId, {
      title: 'Huérfana',
      assigneeId: member.id,
    });
    // Delete the membership behind the service's back, so the assignment stays.
    await app.get(PrismaService).projectMember.delete({
      where: { userId_projectId: { userId: member.id, projectId } },
    });

    expect(await mine(member)).toEqual([]);
  });

  it('reflects reassignments and clearing the assignee', async () => {
    const { owner, member, projectId } = await createTeam(app);
    const task = await createTask(app, owner, projectId, {
      title: 'Movible',
      assigneeId: member.id,
    });
    const url = `/projects/${projectId}/tasks/${task.id}`;

    await api(app, owner).patch(url, { assigneeId: owner.id }).expect(200);
    expect(await mine(member)).toEqual([]);
    expect(titles(await mine(owner))).toEqual(['Movible']);

    await api(app, owner).patch(url, { assigneeId: null }).expect(200);
    expect(await mine(owner)).toEqual([]);
  });
});
