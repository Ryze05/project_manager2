import type { INestApplication } from '@nestjs/common';
import { api, createTestApp, type TestUser } from './support/app.js';
import { createTask, createTeam } from './support/fixtures.js';

describe('Several owners, promoting and leaving (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const role = (p: string, who: TestUser, target: TestUser, r: string) =>
    api(app, who).patch(`/projects/${p}/members/${target.id}`, { role: r });
  const roleOf = async (p: string, viewer: TestUser, target: TestUser) =>
    (
      (await api(app, viewer).get(`/projects/${p}/members`).expect(200))
        .body as { id: string; role: string }[]
    ).find((m) => m.id === target.id)?.role;

  it('an owner promotes a member, who then has owner powers', async () => {
    const { owner, member, projectId: p } = await createTeam(app);
    await role(p, member, member, 'OWNER').expect(403);

    const res = await role(p, owner, member, 'OWNER').expect(200);
    expect(res.body).toMatchObject({ id: member.id, role: 'OWNER' });
    expect(await roleOf(p, owner, member)).toBe('OWNER');

    // The new owner can edit the project and manage members.
    await api(app, member)
      .patch(`/projects/${p}`, { name: 'Nuevo' })
      .expect(200);
    const mine = await api(app, member).get(`/projects/${p}`).expect(200);
    expect(mine.body.role).toBe('OWNER');
  });

  it('promoting an owner again changes nothing and records nothing', async () => {
    const { owner, member, projectId: p } = await createTeam(app);
    await role(p, owner, member, 'OWNER').expect(200);
    await role(p, owner, member, 'OWNER').expect(200);
    const feed = await api(app, owner)
      .get(`/projects/${p}/activity`)
      .expect(200);
    const promoted = (feed.body.items as { type: string }[]).filter(
      (e) => e.type === 'MEMBER_PROMOTED',
    );
    expect(promoted).toHaveLength(1);
  });

  it('an owner can demote another owner or themselves, but never the last one', async () => {
    const { owner, member, outsider, projectId: p } = await createTeam(app);
    await role(p, owner, member, 'MEMBER').expect(200); // already a member: no-op

    // The only owner cannot demote themselves.
    const alone = await role(p, owner, owner, 'MEMBER').expect(409);
    expect(alone.body.message).toMatch(/al menos un propietario/);

    await role(p, owner, member, 'OWNER').expect(200);
    await role(p, member, owner, 'MEMBER').expect(200); // demote the other owner
    expect(await roleOf(p, member, owner)).toBe('MEMBER');
    // The original owner lost owner powers.
    await role(p, owner, member, 'MEMBER').expect(403);
    // The remaining owner is now the last one.
    await role(p, member, member, 'MEMBER').expect(409);

    await role(p, member, outsider, 'OWNER').expect(404); // not a member
  });

  it('refuses invalid roles and outsiders', async () => {
    const { owner, member, outsider, projectId: p } = await createTeam(app);
    await role(p, owner, member, 'ADMIN').expect(400);
    await role(p, outsider, member, 'OWNER').expect(404);
  });

  it('removing an owner needs a demotion first', async () => {
    const { owner, member, projectId: p } = await createTeam(app);
    await role(p, owner, member, 'OWNER').expect(200);
    await api(app, owner)
      .delete(`/projects/${p}/members/${member.id}`)
      .expect(403);
    await role(p, owner, member, 'MEMBER').expect(200);
    await api(app, owner)
      .delete(`/projects/${p}/members/${member.id}`)
      .expect(204);
  });

  it('a member leaves: tasks unassigned, comments kept, access gone', async () => {
    const { owner, member, projectId: p } = await createTeam(app);
    const task = await createTask(app, owner, p, {
      title: 'T',
      assigneeId: member.id,
    });
    await api(app, member)
      .post(`/projects/${p}/tasks/${task.id}/comments`, { content: 'hola' })
      .expect(201);

    await api(app, member).post(`/projects/${p}/leave`).expect(204);

    await api(app, member).get(`/projects/${p}`).expect(404);
    const seen = await api(app, owner)
      .get(`/projects/${p}/tasks/${task.id}`)
      .expect(200);
    expect(seen.body.assignee).toBeNull();
    const comments = await api(app, owner)
      .get(`/projects/${p}/tasks/${task.id}/comments`)
      .expect(200);
    expect(comments.body).toHaveLength(1);
    const feed = await api(app, owner)
      .get(`/projects/${p}/activity`)
      .expect(200);
    expect(
      (feed.body.items as { type: string }[]).map((e) => e.type),
    ).toContain('MEMBER_LEFT');
  });

  it('the last owner cannot leave, one of two can', async () => {
    const { owner, member, outsider, projectId: p } = await createTeam(app);
    const refused = await api(app, owner)
      .post(`/projects/${p}/leave`)
      .expect(409);
    expect(refused.body.message).toMatch(/al menos un propietario/);

    await role(p, owner, member, 'OWNER').expect(200);
    await api(app, owner).post(`/projects/${p}/leave`).expect(204);
    expect(await roleOf(p, member, member)).toBe('OWNER');

    await api(app, outsider).post(`/projects/${p}/leave`).expect(404);
  });

  it('nobody can leave or change roles in an archived project', async () => {
    const { owner, member, projectId: p } = await createTeam(app);
    await api(app, owner).post(`/projects/${p}/archive`).expect(200);
    await api(app, member).post(`/projects/${p}/leave`).expect(409);
    await role(p, owner, member, 'OWNER').expect(409);
  });

  it('an owner who is not the creator can delete the project', async () => {
    const { owner, member, projectId: p } = await createTeam(app);
    await role(p, owner, member, 'OWNER').expect(200);
    await api(app, member).delete(`/projects/${p}`).expect(204);
  });
});
