import type { INestApplication } from '@nestjs/common';
import { api, createTestApp, type TestUser } from './support/app.js';
import {
  createComment,
  createSubtask,
  createTask,
  createTeam,
} from './support/fixtures.js';

interface Item {
  id: string;
  type: string;
  actor: { id: string; name: string };
  task: {
    id: string;
    title: string;
    isSubtask: boolean;
    deleted: boolean;
  } | null;
  data: Record<string, unknown> | null;
}

describe('Activity (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const feed = async (
    user: TestUser,
    projectId: string,
    query = '',
  ): Promise<{ items: Item[]; nextCursor: string | null }> =>
    (
      await api(app, user)
        .get(`/projects/${projectId}/activity${query}`)
        .expect(200)
    ).body;
  const types = async (user: TestUser, projectId: string, query = '') =>
    (await feed(user, projectId, query)).items.map((i) => i.type);

  it('records the creation of a task and of a subtask, newest first', async () => {
    const team = await createTeam(app);
    const task = await createTask(app, team.owner, team.projectId, {
      title: 'Padre',
    });
    await createSubtask(app, team.member, team.projectId, task.id, {
      title: 'Hija',
    });

    const { items } = await feed(team.owner, team.projectId);
    expect(
      items.map((i) => [
        i.type,
        i.task?.title,
        i.task?.isSubtask,
        i.actor.name,
      ]),
    ).toEqual([
      // Members were added by createTeam, so they come after (older).
      ['TASK_CREATED', 'Hija', true, 'Pablo'],
      ['TASK_CREATED', 'Padre', false, 'Marta'],
      ['MEMBER_ADDED', undefined, undefined, 'Marta'],
    ]);
  });

  it('writes one event per changed field and nothing when the value is the same', async () => {
    const team = await createTeam(app);
    const task = await createTask(app, team.owner, team.projectId, {
      title: 'T',
    });
    const url = `/projects/${team.projectId}/tasks/${task.id}`;

    await api(app, team.member)
      .patch(url, {
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        dueDate: '2030-01-05',
      })
      .expect(200);
    // The same values again: no new events.
    await api(app, team.member)
      .patch(url, {
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        dueDate: '2030-01-05',
      })
      .expect(200);

    const { items } = await feed(
      team.owner,
      team.projectId,
      `?taskId=${task.id}`,
    );
    expect(items.map((i) => i.type).sort()).toEqual([
      'DUE_DATE_CHANGED',
      'PRIORITY_CHANGED',
      'STATUS_CHANGED',
      'TASK_CREATED',
    ]);
    const status = items.find((i) => i.type === 'STATUS_CHANGED');
    expect(status?.data).toEqual({ from: 'TODO', to: 'IN_PROGRESS' });
    expect(status?.actor.name).toBe('Pablo');
  });

  it('records assignee, labels and comments', async () => {
    const team = await createTeam(app);
    const label = (
      await api(app, team.owner)
        .post(`/projects/${team.projectId}/labels`, { name: 'Bug' })
        .expect(201)
    ).body as { id: string };
    const task = await createTask(app, team.owner, team.projectId, {
      title: 'T',
    });
    await api(app, team.owner)
      .patch(`/projects/${team.projectId}/tasks/${task.id}`, {
        assigneeId: team.member.id,
        labelIds: [label.id],
      })
      .expect(200);
    await createComment(app, team.member, team.projectId, task.id, 'Hola');

    const { items } = await feed(
      team.owner,
      team.projectId,
      `?taskId=${task.id}`,
    );
    const byType = Object.fromEntries(items.map((i) => [i.type, i.data]));
    expect(byType.ASSIGNEE_CHANGED).toEqual({ from: null, to: 'Pablo' });
    expect(byType.LABEL_ADDED).toEqual({ label: 'Bug' });
    expect(items.map((i) => i.type)).toContain('COMMENT_ADDED');
    // The comment text is not copied into the history.
    expect(JSON.stringify(items)).not.toContain('Hola');
  });

  it('reopening a done parent through a new subtask is recorded on the parent', async () => {
    const team = await createTeam(app);
    const task = await createTask(app, team.owner, team.projectId, {
      title: 'P',
    });
    await api(app, team.owner)
      .patch(`/projects/${team.projectId}/tasks/${task.id}`, { status: 'DONE' })
      .expect(200);
    await createSubtask(app, team.owner, team.projectId, task.id, {
      title: 'S',
    });

    const { items } = await feed(
      team.owner,
      team.projectId,
      `?taskId=${task.id}`,
    );
    // On the parent itself (not on the subtask), next to the subtask's creation.
    expect(
      items.find(
        (i) =>
          i.type === 'STATUS_CHANGED' &&
          i.data?.to === 'IN_PROGRESS' &&
          i.task?.title === 'P',
      ),
    ).toMatchObject({ data: { from: 'DONE', to: 'IN_PROGRESS' } });
    expect(
      items.some((i) => i.type === 'TASK_CREATED' && i.task?.title === 'S'),
    ).toBe(true);
  });

  it("a parent's history includes creating and completing its subtasks, but nothing else of them", async () => {
    const team = await createTeam(app);
    const parent = await createTask(app, team.owner, team.projectId, {
      title: 'Padre',
    });
    const sub = await createSubtask(
      app,
      team.member,
      team.projectId,
      parent.id,
      { title: 'Hija' },
    );
    const subUrl = `/projects/${team.projectId}/tasks/${sub.id}`;
    await api(app, team.member).patch(subUrl, { priority: 'HIGH' }).expect(200);
    await createComment(app, team.member, team.projectId, sub.id, 'x');
    await api(app, team.member)
      .patch(subUrl, { status: 'IN_PROGRESS' })
      .expect(200);
    await api(app, team.member).patch(subUrl, { status: 'DONE' }).expect(200);

    const parentFeed = await feed(
      team.owner,
      team.projectId,
      `?taskId=${parent.id}`,
    );
    expect(
      parentFeed.items.map((i) => [i.type, i.task?.title, i.data]),
    ).toEqual([
      ['STATUS_CHANGED', 'Hija', { from: 'IN_PROGRESS', to: 'DONE' }],
      ['TASK_CREATED', 'Hija', null],
      ['TASK_CREATED', 'Padre', null],
    ]);

    // The subtask's own history has all of its events, and none of the parent's.
    const subFeed = await feed(team.owner, team.projectId, `?taskId=${sub.id}`);
    expect(subFeed.items.map((i) => i.type).sort()).toEqual([
      'COMMENT_ADDED',
      'PRIORITY_CHANGED',
      'STATUS_CHANGED',
      'STATUS_CHANGED',
      'TASK_CREATED',
    ]);
    expect(subFeed.items.every((i) => i.task?.title === 'Hija')).toBe(true);
  });

  it('keeps the trace of a deleted task, marked as deleted', async () => {
    const team = await createTeam(app);
    const task = await createTask(app, team.owner, team.projectId, {
      title: 'Borrame',
    });
    await createSubtask(app, team.owner, team.projectId, task.id, {
      title: 'S',
    });
    await api(app, team.owner)
      .delete(`/projects/${team.projectId}/tasks/${task.id}`)
      .expect(204);

    const { items } = await feed(team.owner, team.projectId);
    const deleted = items.find((i) => i.type === 'TASK_DELETED');
    expect(deleted).toMatchObject({
      task: { title: 'Borrame', deleted: true },
      data: { subtasks: 1 },
    });
    // The creation event of the same task survives and is flagged too.
    expect(
      items.find(
        (i) => i.type === 'TASK_CREATED' && i.task?.title === 'Borrame',
      )?.task?.deleted,
    ).toBe(true);
  });

  it('records members added and removed (and unassigning is not a task event)', async () => {
    const team = await createTeam(app);
    const task = await createTask(app, team.owner, team.projectId, {
      title: 'T',
      assigneeId: team.member.id,
    });
    await api(app, team.owner)
      .delete(`/projects/${team.projectId}/members/${team.member.id}`)
      .expect(204);

    const { items } = await feed(team.owner, team.projectId);
    expect(items[0]).toMatchObject({
      type: 'MEMBER_REMOVED',
      data: { name: 'Pablo' },
      task: null,
    });
    expect(
      await types(team.owner, team.projectId, `?taskId=${task.id}`),
    ).toEqual(['TASK_CREATED']);
  });

  it('paginates with a cursor without repeating or skipping events', async () => {
    const team = await createTeam(app);
    const task = await createTask(app, team.owner, team.projectId, {
      title: 'T',
    });
    // One edit writing three events with the same timestamp.
    await api(app, team.owner)
      .patch(`/projects/${team.projectId}/tasks/${task.id}`, {
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        title: 'T2',
      })
      .expect(200);

    const all = (await feed(team.owner, team.projectId)).items.map((i) => i.id);
    expect(all).toHaveLength(5);

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await feed(
        team.owner,
        team.projectId,
        `?limit=2${cursor ? `&cursor=${cursor}` : ''}`,
      );
      seen.push(...page.items.map((i) => i.id));
      cursor = page.nextCursor;
    } while (cursor);
    expect(seen).toEqual(all);
  });

  it('filters by who did it, also together with a task', async () => {
    const team = await createTeam(app);
    const task = await createTask(app, team.owner, team.projectId, {
      title: 'T',
    });
    await api(app, team.member)
      .patch(`/projects/${team.projectId}/tasks/${task.id}`, {
        priority: 'HIGH',
      })
      .expect(200);
    await createComment(app, team.member, team.projectId, task.id, 'x');

    const byMember = await feed(
      team.owner,
      team.projectId,
      `?actorId=${team.member.id}`,
    );
    expect(byMember.items.map((i) => i.type).sort()).toEqual([
      'COMMENT_ADDED',
      'PRIORITY_CHANGED',
    ]);
    expect(byMember.items.every((i) => i.actor.id === team.member.id)).toBe(
      true,
    );

    const byOwnerOnTask = await feed(
      team.owner,
      team.projectId,
      `?actorId=${team.owner.id}&taskId=${task.id}`,
    );
    expect(byOwnerOnTask.items.map((i) => i.type)).toEqual(['TASK_CREATED']);
    // Nobody in particular: all of it.
    expect((await feed(team.owner, team.projectId)).items).toHaveLength(4);
  });

  it('is for members only, and a cursor of another project is a 404', async () => {
    const team = await createTeam(app);
    const other = await createTeam(app);
    await createTask(app, other.owner, other.projectId, { title: 'X' });
    const foreign = (await feed(other.owner, other.projectId)).items[0].id;

    await api(app, team.outsider)
      .get(`/projects/${team.projectId}/activity`)
      .expect(404);
    await api(app, team.member)
      .get(`/projects/${team.projectId}/activity`)
      .expect(200);
    await api(app, team.owner)
      .get(`/projects/${team.projectId}/activity?cursor=${foreign}`)
      .expect(404);
  });

  it('rejects bad query values', async () => {
    const team = await createTeam(app);
    const get = (q: string) =>
      api(app, team.owner).get(`/projects/${team.projectId}/activity${q}`);
    await get('?limit=0').expect(400);
    await get('?limit=101').expect(400);
    await get('?cursor=nope').expect(400);
    await get('?taskId=nope').expect(400);
    await get('?actorId=nope').expect(400);
  });
});
