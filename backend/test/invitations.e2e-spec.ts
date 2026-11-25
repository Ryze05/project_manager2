import type { INestApplication } from '@nestjs/common';
import { api, createTestApp, registerUser } from './support/app.js';
import { createTask, createTeam } from './support/fixtures.js';

describe('Invitations (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const invite = (
    team: Awaited<ReturnType<typeof createTeam>>,
    email: string,
    who = team.owner,
  ) => api(app, who).post(`/projects/${team.projectId}/invitations`, { email });

  it('inviting does not add anyone: the user sees it and joins by accepting', async () => {
    const team = await createTeam(app);
    const res = await invite(team, team.outsider.email.toUpperCase()).expect(
      201,
    );
    expect(res.body).toMatchObject({
      user: { id: team.outsider.id, email: team.outsider.email },
      invitedBy: { id: team.owner.id },
    });

    // Still an outsider.
    await api(app, team.outsider)
      .get(`/projects/${team.projectId}`)
      .expect(404);

    const mine = await api(app, team.outsider)
      .get('/me/invitations')
      .expect(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0]).toMatchObject({
      project: { id: team.projectId, name: 'Proyecto' },
      invitedBy: { name: 'Marta' },
    });

    const accepted = await api(app, team.outsider)
      .post(`/me/invitations/${mine.body[0].id}/accept`)
      .expect(200);
    expect(accepted.body).toEqual({ projectId: team.projectId });

    const view = await api(app, team.outsider)
      .get(`/projects/${team.projectId}`)
      .expect(200);
    expect(view.body.role).toBe('MEMBER');
    // The invitation is consumed, on both sides.
    expect((await api(app, team.outsider).get('/me/invitations')).body).toEqual(
      [],
    );
    expect(
      (
        await api(app, team.owner).get(
          `/projects/${team.projectId}/invitations`,
        )
      ).body,
    ).toEqual([]);
    const feed = await api(app, team.owner)
      .get(`/projects/${team.projectId}/activity`)
      .expect(200);
    expect(feed.body.items[0]).toMatchObject({
      type: 'INVITATION_ACCEPTED',
      actor: { id: team.outsider.id },
    });
  });

  it('declining leaves the user outside and lets the owner invite again', async () => {
    const team = await createTeam(app);
    await invite(team, team.outsider.email).expect(201);
    const [{ id }] = (await api(app, team.outsider).get('/me/invitations'))
      .body;
    await api(app, team.outsider)
      .post(`/me/invitations/${id}/decline`)
      .expect(204);

    await api(app, team.outsider)
      .get(`/projects/${team.projectId}`)
      .expect(404);
    await api(app, team.outsider)
      .post(`/me/invitations/${id}/accept`)
      .expect(404);
    await invite(team, team.outsider.email).expect(201);
  });

  it('the owner lists and cancels pending invitations', async () => {
    const team = await createTeam(app);
    const created = await invite(team, team.outsider.email).expect(201);

    const list = await api(app, team.owner)
      .get(`/projects/${team.projectId}/invitations`)
      .expect(200);
    expect(list.body.map((i: { id: string }) => i.id)).toEqual([
      created.body.id,
    ]);

    await api(app, team.owner)
      .delete(`/projects/${team.projectId}/invitations/${created.body.id}`)
      .expect(204);
    expect((await api(app, team.outsider).get('/me/invitations')).body).toEqual(
      [],
    );
    await api(app, team.outsider)
      .post(`/me/invitations/${created.body.id}/accept`)
      .expect(404);
    await api(app, team.owner)
      .delete(`/projects/${team.projectId}/invitations/${created.body.id}`)
      .expect(404);
  });

  it('is owner-only: a member gets 403, an outsider 404', async () => {
    const team = await createTeam(app);
    const target = await registerUser(app, 'Nuevo');
    await invite(team, target.email, team.member).expect(403);
    await invite(team, target.email, team.outsider).expect(404);
    await api(app, team.member)
      .get(`/projects/${team.projectId}/invitations`)
      .expect(403);
  });

  it('refuses bad emails, unknown users, members and repeated invitations', async () => {
    const team = await createTeam(app);
    await invite(team, 'nope').expect(400);
    await invite(team, ` ${team.outsider.email} `).expect(400);

    const unknown = await invite(
      team,
      `nadie-${crypto.randomUUID()}@example.com`,
    ).expect(404);
    expect(unknown.body.message).toBe(
      'No hay ningún usuario registrado con ese email',
    );

    await invite(team, team.member.email.toUpperCase()).expect(409);

    await invite(team, team.outsider.email).expect(201);
    await invite(team, team.outsider.email).expect(409);
  });

  it("nobody can answer someone else's invitation", async () => {
    const team = await createTeam(app);
    const stranger = await registerUser(app, 'Intruso');
    const created = await invite(team, team.outsider.email).expect(201);

    await api(app, stranger)
      .post(`/me/invitations/${created.body.id}/accept`)
      .expect(404);
    await api(app, stranger)
      .post(`/me/invitations/${created.body.id}/decline`)
      .expect(404);
    await api(app, team.owner)
      .post(`/me/invitations/${created.body.id}/accept`)
      .expect(404);
    expect(
      (await api(app, team.outsider).get('/me/invitations')).body,
    ).toHaveLength(1);
  });

  it('accepting twice joins once and the second answer is a 404', async () => {
    const team = await createTeam(app);
    const created = await invite(team, team.outsider.email).expect(201);
    const accept = () =>
      api(app, team.outsider).post(`/me/invitations/${created.body.id}/accept`);
    await accept().expect(200);
    await accept().expect(404);
  });

  it('an invited user who leaves can be invited again; a removed one too', async () => {
    const team = await createTeam(app);
    await api(app, team.member)
      .post(`/projects/${team.projectId}/leave`)
      .expect(204);
    await invite(team, team.member.email).expect(201);
  });

  it('archived projects: no inviting, no pending invitation in the inbox, no joining', async () => {
    const team = await createTeam(app);
    const created = await invite(team, team.outsider.email).expect(201);
    await api(app, team.owner)
      .post(`/projects/${team.projectId}/archive`)
      .expect(200);

    await invite(team, (await registerUser(app, 'Otro')).email).expect(409);
    expect((await api(app, team.outsider).get('/me/invitations')).body).toEqual(
      [],
    );
    await api(app, team.outsider)
      .post(`/me/invitations/${created.body.id}/accept`)
      .expect(409);

    // Back to normal once unarchived; the owner can still cancel meanwhile.
    await api(app, team.owner)
      .post(`/projects/${team.projectId}/unarchive`)
      .expect(200);
    await api(app, team.outsider)
      .post(`/me/invitations/${created.body.id}/accept`)
      .expect(200);
  });

  it('deleting the project takes its invitations with it', async () => {
    const team = await createTeam(app);
    await invite(team, team.outsider.email).expect(201);
    await createTask(app, team.owner, team.projectId, { title: 'T' });
    await api(app, team.owner)
      .delete(`/projects/${team.projectId}`)
      .expect(204);
    expect((await api(app, team.outsider).get('/me/invitations')).body).toEqual(
      [],
    );
  });
});
