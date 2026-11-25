import type { INestApplication } from '@nestjs/common';
import { api, createTestApp, type TestUser } from './support/app.js';
import { createSubtask, createTask, createTeam } from './support/fixtures.js';

describe('Board order and drag and drop (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const column = async (
    user: TestUser,
    projectId: string,
    status: 'TODO' | 'IN_PROGRESS' | 'DONE',
  ) =>
    (
      (await api(app, user).get(`/projects/${projectId}/board`).expect(200))
        .body[status] as { title: string }[]
    ).map((t) => t.title);
  const move = (
    user: TestUser,
    projectId: string,
    taskId: string,
    body: object,
  ) =>
    api(app, user).patch(`/projects/${projectId}/tasks/${taskId}/move`, body);

  /** TODO column with tasks A, B, C (in that order), by creating them. */
  async function abc() {
    const team = await createTeam(app);
    const mk = (title: string, extra: object = {}) =>
      createTask(app, team.owner, team.projectId, { title, ...extra });
    // Priority and date would have sorted them differently under the old automatic order.
    const a = await mk('A', { priority: 'LOW' });
    const b = await mk('B', { priority: 'HIGH', dueDate: '2030-01-01' });
    const c = await mk('C', { priority: 'MEDIUM' });
    return { team, a, b, c };
  }

  it('new tasks go to the end, whatever their priority or date', async () => {
    const { team } = await abc();
    expect(await column(team.owner, team.projectId, 'TODO')).toEqual([
      'A',
      'B',
      'C',
    ]);
  });

  it('puts a card between two others, at the top, and at the end', async () => {
    const { team, a, b, c } = await abc();
    const p = team.projectId;

    // C between A and B.
    await move(team.owner, p, c.id, {
      status: 'TODO',
      afterTaskId: a.id,
      beforeTaskId: b.id,
    }).expect(200);
    expect(await column(team.owner, p, 'TODO')).toEqual(['A', 'C', 'B']);
    // B to the top.
    await move(team.owner, p, b.id, {
      status: 'TODO',
      beforeTaskId: a.id,
    }).expect(200);
    expect(await column(team.owner, p, 'TODO')).toEqual(['B', 'A', 'C']);
    // B to the end.
    await move(team.owner, p, b.id, {
      status: 'TODO',
      afterTaskId: c.id,
    }).expect(200);
    expect(await column(team.owner, p, 'TODO')).toEqual(['A', 'C', 'B']);
    // No neighbours: the end.
    await move(team.owner, p, a.id, { status: 'TODO' }).expect(200);
    expect(await column(team.owner, p, 'TODO')).toEqual(['C', 'B', 'A']);
  });

  it('moving to another column changes the status and lands where it was dropped', async () => {
    const { team, a, b, c } = await abc();
    const p = team.projectId;
    await move(team.owner, p, a.id, { status: 'IN_PROGRESS' }).expect(200);
    const res = await move(team.owner, p, c.id, {
      status: 'IN_PROGRESS',
      beforeTaskId: a.id,
    }).expect(200);
    expect(res.body.status).toBe('IN_PROGRESS');
    expect(await column(team.owner, p, 'IN_PROGRESS')).toEqual(['C', 'A']);
    expect(await column(team.owner, p, 'TODO')).toEqual(['B']);
    void b;
  });

  it('changing status without dragging puts the task at the end of the new column', async () => {
    const { team, a, b } = await abc();
    const p = team.projectId;
    await api(app, team.owner)
      .patch(`/projects/${p}/tasks/${a.id}`, { status: 'IN_PROGRESS' })
      .expect(200);
    await api(app, team.owner)
      .patch(`/projects/${p}/tasks/${b.id}`, { status: 'IN_PROGRESS' })
      .expect(200);
    expect(await column(team.owner, p, 'IN_PROGRESS')).toEqual(['A', 'B']);
  });

  it('keeps the order when the gap between two cards runs out (renumbering)', async () => {
    const team = await createTeam(app);
    const p = team.projectId;
    const make = (title: string) => createTask(app, team.owner, p, { title });
    const first = await make('A');
    const last = await make('B');

    // Each new card goes right under A, so the gap above it halves every time:
    // after ~20 drops it is too small to split and the column has to be renumbered.
    const dropped: string[] = [];
    let previous: string = last.id;
    for (let i = 1; i <= 30; i++) {
      const card = await make(`T${i}`);
      await move(team.owner, p, card.id, {
        status: 'TODO',
        afterTaskId: first.id,
        beforeTaskId: previous,
      }).expect(200);
      dropped.push(`T${i}`);
      previous = card.id;
    }
    expect(await column(team.owner, p, 'TODO')).toEqual([
      'A',
      ...dropped.reverse(),
      'B',
    ]);
  });

  it('keeps the rules of a status change and the tasks in their place when refused', async () => {
    const { team, a, b, c } = await abc();
    const p = team.projectId;
    await createSubtask(app, team.owner, p, a.id, { title: 'pendiente' });
    // 409: pending subtask, and nothing moved.
    await move(team.owner, p, a.id, { status: 'DONE' }).expect(409);
    expect(await column(team.owner, p, 'TODO')).toEqual(['A', 'B', 'C']);
    void b;
    void c;
  });

  it('rejects subtasks, itself as a neighbour, and neighbours from another column or project', async () => {
    const { team, a, b } = await abc();
    const other = await abc();
    const p = team.projectId;
    const sub = await createSubtask(app, team.owner, p, a.id, { title: 'S' });

    await move(team.owner, p, sub.id, { status: 'TODO' }).expect(400);
    await move(team.owner, p, a.id, {
      status: 'TODO',
      afterTaskId: a.id,
    }).expect(400);
    // B is in TODO, so it is not a neighbour in IN_PROGRESS.
    await move(team.owner, p, a.id, {
      status: 'IN_PROGRESS',
      afterTaskId: b.id,
    }).expect(400);
    // A subtask is not a card of the board, even in the same column.
    await move(team.owner, p, b.id, {
      status: 'TODO',
      afterTaskId: sub.id,
    }).expect(400);
    // A card of another project.
    await move(team.owner, p, a.id, {
      status: 'TODO',
      afterTaskId: other.b.id,
    }).expect(400);
    // The task itself of another project is a 404.
    await move(team.owner, p, other.a.id, { status: 'TODO' }).expect(404);
    // Bad values.
    await move(team.owner, p, a.id, { status: 'NOPE' }).expect(400);
    await move(team.owner, p, a.id, {
      status: 'TODO',
      afterTaskId: 'x',
    }).expect(400);
    expect(await column(team.owner, p, 'TODO')).toEqual(['A', 'B', 'C']);
  });

  it('any member can drag, outsiders get 404', async () => {
    const { team, a } = await abc();
    await move(team.member, team.projectId, a.id, {
      status: 'IN_PROGRESS',
    }).expect(200);
    await move(team.outsider, team.projectId, a.id, { status: 'TODO' }).expect(
      404,
    );
  });

  it('records the change of column in the history, but not reordering inside a column', async () => {
    const { team, a, b } = await abc();
    const p = team.projectId;
    await move(team.owner, p, b.id, {
      status: 'TODO',
      beforeTaskId: a.id,
    }).expect(200); // reorder only
    await move(team.owner, p, a.id, { status: 'IN_PROGRESS' }).expect(200); // column change
    const feed = (
      await api(app, team.owner).get(`/projects/${p}/activity`).expect(200)
    ).body.items as { type: string; task?: { title: string } }[];
    const statusEvents = feed.filter((i) => i.type === 'STATUS_CHANGED');
    expect(statusEvents).toHaveLength(1);
    expect(statusEvents[0].task?.title).toBe('A');
  });
});
