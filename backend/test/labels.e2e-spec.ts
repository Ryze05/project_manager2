import type { INestApplication } from '@nestjs/common';
import { api, createTestApp, type TestUser } from './support/app.js';
import { createSubtask, createTask, createTeam } from './support/fixtures.js';

describe('Labels and board filters (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const labelsUrl = (projectId: string) => `/projects/${projectId}/labels`;
  const newLabel = async (user: TestUser, projectId: string, name: string) =>
    (await api(app, user).post(labelsUrl(projectId), { name }).expect(201))
      .body as { id: string; name: string; taskCount: number };

  const boardTitles = async (user: TestUser, projectId: string, query = '') => {
    const res = await api(app, user)
      .get(`/projects/${projectId}/board${query}`)
      .expect(200);
    return (Object.values(res.body) as { title: string }[][])
      .flat()
      .map((t) => t.title)
      .sort();
  };

  describe('label management', () => {
    it('lets any member create and list; names are unique ignoring case', async () => {
      const team = await createTeam(app);
      await newLabel(team.member, team.projectId, 'Bug');

      await api(app, team.owner)
        .post(labelsUrl(team.projectId), { name: 'bug' })
        .expect(409);
      const list = await api(app, team.owner)
        .get(labelsUrl(team.projectId))
        .expect(200);
      expect(list.body).toEqual([
        expect.objectContaining({ name: 'Bug', taskCount: 0 }),
      ]);
    });

    it('rejects empty names and hides the project from outsiders', async () => {
      const team = await createTeam(app);
      await api(app, team.owner)
        .post(labelsUrl(team.projectId), { name: '   ' })
        .expect(400);
      await api(app, team.outsider).get(labelsUrl(team.projectId)).expect(404);
      await api(app, team.outsider)
        .post(labelsUrl(team.projectId), { name: 'x' })
        .expect(404);
    });

    it('only the owner renames or deletes', async () => {
      const team = await createTeam(app);
      const label = await newLabel(team.member, team.projectId, 'Diseño');
      const url = `${labelsUrl(team.projectId)}/${label.id}`;

      await api(app, team.member).patch(url, { name: 'UX' }).expect(403);
      await api(app, team.member).delete(url).expect(403);
      const renamed = await api(app, team.owner)
        .patch(url, { name: 'UX' })
        .expect(200);
      expect(renamed.body.name).toBe('UX');
      // Renaming to its own name in another case is allowed, to a taken one is not.
      await newLabel(team.owner, team.projectId, 'Otra');
      await api(app, team.owner).patch(url, { name: 'otra' }).expect(409);
      await api(app, team.owner).patch(url, { name: 'ux' }).expect(200);
      await api(app, team.owner).delete(url).expect(204);
    });

    it('a label id of another project is a 404', async () => {
      const a = await createTeam(app);
      const b = await createTeam(app);
      const label = await newLabel(a.owner, a.projectId, 'Solo A');
      await api(app, b.owner)
        .patch(`${labelsUrl(b.projectId)}/${label.id}`, { name: 'x' })
        .expect(404);
    });
  });

  describe('labels on tasks', () => {
    it('creates with labels, replaces them on update, and leaves them if omitted', async () => {
      const team = await createTeam(app);
      const a = await newLabel(team.owner, team.projectId, 'A');
      const b = await newLabel(team.owner, team.projectId, 'B');
      const task = await createTask(app, team.owner, team.projectId, {
        title: 'T',
        labelIds: [b.id, a.id],
      });
      expect((task.labels as { name: string }[]).map((l) => l.name)).toEqual([
        'A',
        'B',
      ]);

      const url = `/projects/${team.projectId}/tasks/${task.id}`;
      const kept = await api(app, team.owner)
        .patch(url, { title: 'T2' })
        .expect(200);
      expect(kept.body.labels).toHaveLength(2);
      const replaced = await api(app, team.owner)
        .patch(url, { labelIds: [a.id] })
        .expect(200);
      expect(replaced.body.labels).toEqual([{ id: a.id, name: 'A' }]);
      const cleared = await api(app, team.owner)
        .patch(url, { labelIds: [] })
        .expect(200);
      expect(cleared.body.labels).toEqual([]);
      await api(app, team.owner).patch(url, { labelIds: null }).expect(400);
    });

    it('rejects labels from another project and labels on subtasks', async () => {
      const team = await createTeam(app);
      const other = await createTeam(app);
      const foreign = await newLabel(other.owner, other.projectId, 'Ajena');
      const mine = await newLabel(team.owner, team.projectId, 'Mia');

      await api(app, team.owner)
        .post(`/projects/${team.projectId}/tasks`, {
          title: 'T',
          labelIds: [foreign.id],
        })
        .expect(400);

      const parent = await createTask(app, team.owner, team.projectId, {
        title: 'P',
      });
      await api(app, team.owner)
        .post(`/projects/${team.projectId}/tasks/${parent.id}/subtasks`, {
          title: 'S',
          labelIds: [mine.id],
        })
        .expect(400);
      const sub = await createSubtask(
        app,
        team.owner,
        team.projectId,
        parent.id,
        { title: 'S' },
      );
      await api(app, team.owner)
        .patch(`/projects/${team.projectId}/tasks/${sub.id}`, {
          labelIds: [mine.id],
        })
        .expect(400);
    });

    it('deleting a label only takes it off the tasks', async () => {
      const team = await createTeam(app);
      const label = await newLabel(team.owner, team.projectId, 'Temp');
      const task = await createTask(app, team.owner, team.projectId, {
        title: 'T',
        labelIds: [label.id],
      });
      const list = await api(app, team.owner)
        .get(labelsUrl(team.projectId))
        .expect(200);
      expect(list.body[0].taskCount).toBe(1);

      await api(app, team.owner)
        .delete(`${labelsUrl(team.projectId)}/${label.id}`)
        .expect(204);
      const after = await api(app, team.owner)
        .get(`/projects/${team.projectId}/tasks/${task.id}`)
        .expect(200);
      expect(after.body.labels).toEqual([]);
    });
  });

  describe('board filters', () => {
    it('combines different filters with AND and several labels with OR', async () => {
      const team = await createTeam(app);
      const bug = await newLabel(team.owner, team.projectId, 'Bug');
      const ux = await newLabel(team.owner, team.projectId, 'UX');
      const mk = (title: string, extra: object) =>
        createTask(app, team.owner, team.projectId, { title, ...extra });
      await mk('bug-alta', { labelIds: [bug.id], priority: 'HIGH' });
      await mk('bug-baja', { labelIds: [bug.id], priority: 'LOW' });
      await mk('ux-alta', { labelIds: [ux.id], priority: 'HIGH' });
      await mk('sin-etiqueta', { priority: 'HIGH' });

      const q = (s: string) => boardTitles(team.owner, team.projectId, s);
      expect(await q(`?label=${bug.id}`)).toEqual(['bug-alta', 'bug-baja']);
      expect(await q(`?label=${bug.id}&label=${ux.id}`)).toEqual([
        'bug-alta',
        'bug-baja',
        'ux-alta',
      ]);
      expect(await q(`?label=${bug.id}&priority=HIGH`)).toEqual(['bug-alta']);
      expect(await q('?priority=HIGH&priority=LOW')).toHaveLength(4);
    });

    it('rejects invalid filter values', async () => {
      const team = await createTeam(app);
      const get = (s: string) =>
        api(app, team.owner).get(`/projects/${team.projectId}/board${s}`);
      await get('?priority=BOGUS').expect(400);
      await get('?label=no-uuid').expect(400);
      await get('?due=tomorrow').expect(400);
      await get('?assignee=nadie').expect(400);
    });

    it('filters by assignee, also through subtasks, and by "none"', async () => {
      const team = await createTeam(app);
      const owner = (await api(app, team.owner).get('/auth/me').expect(200))
        .body.id as string;
      const member = (await api(app, team.member).get('/auth/me').expect(200))
        .body.id as string;
      await createTask(app, team.owner, team.projectId, {
        title: 'del-miembro',
        assigneeId: member,
      });
      await createTask(app, team.owner, team.projectId, {
        title: 'del-dueño',
        assigneeId: owner,
      });
      await createTask(app, team.owner, team.projectId, { title: 'libre' });
      const parent = await createTask(app, team.owner, team.projectId, {
        title: 'padre-con-subtarea-del-miembro',
        assigneeId: owner,
      });
      await createSubtask(app, team.owner, team.projectId, parent.id, {
        title: 'sub',
        assigneeId: member,
      });

      const q = (s: string) => boardTitles(team.owner, team.projectId, s);
      expect(await q(`?assignee=${member}`)).toEqual([
        'del-miembro',
        'padre-con-subtarea-del-miembro',
      ]);
      expect(await q('?assignee=none')).toEqual(['libre']);
    });

    it('filters by due date: overdue (not done), this week, none', async () => {
      const team = await createTeam(app);
      const day = (offset: number) =>
        new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
      const mk = (title: string, extra: object) =>
        createTask(app, team.owner, team.projectId, { title, ...extra });
      await mk('vencida', { dueDate: day(-3) });
      const done = await mk('vencida-hecha', { dueDate: day(-3) });
      await api(app, team.owner)
        .patch(`/projects/${team.projectId}/tasks/${done.id}`, {
          status: 'DONE',
        })
        .expect(200);
      await mk('hoy', { dueDate: day(0) });
      await mk('en-5-dias', { dueDate: day(5) });
      await mk('en-30-dias', { dueDate: day(30) });
      await mk('sin-fecha', {});

      const q = (s: string) => boardTitles(team.owner, team.projectId, s);
      expect(await q('?due=overdue')).toEqual(['vencida']);
      expect(await q('?due=week')).toEqual(['en-5-dias', 'hoy']);
      expect(await q('?due=none')).toEqual(['sin-fecha']);
    });
  });
});
