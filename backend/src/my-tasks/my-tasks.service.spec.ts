import { MyTasksService } from './my-tasks.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('MyTasksService', () => {
  const findMany = vi.fn();
  const service = new MyTasksService({
    task: { findMany },
  } as unknown as PrismaService);

  const date = new Date('2026-01-01');
  const row = (overrides = {}) => ({
    id: 't1',
    title: 'Tarea',
    description: null,
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: null,
    projectId: 'p1',
    parentId: null,
    creatorId: 'u2',
    assignee: { id: 'u1', name: 'Ana', email: 'ana@x.com' },
    subtasks: [{ status: 'DONE' }, { status: 'TODO' }],
    project: { id: 'p1', name: 'Proyecto' },
    parent: null,
    createdAt: date,
    updatedAt: date,
    ...overrides,
  });

  beforeEach(() => {
    vi.resetAllMocks();
    findMany.mockResolvedValue([]);
  });

  it('asks only for my tasks, in active projects where I am still a member', async () => {
    await service.list('u1');

    const { where } = findMany.mock.calls[0][0];
    expect(where.assigneeId).toBe('u1');
    expect(where.project).toEqual({
      archivedAt: null,
      members: { some: { userId: 'u1' } },
    });
  });

  it('hides done tasks by default and shows them with includeDone', async () => {
    await service.list('u1');
    await service.list('u1', false);
    await service.list('u1', true);

    const [def, off, on] = findMany.mock.calls.map((c) => c[0].where);
    expect(def.status).toEqual({ not: 'DONE' });
    expect(off.status).toEqual({ not: 'DONE' });
    expect(on).not.toHaveProperty('status');
  });

  it('orders by due date (none last), then priority, then age', async () => {
    await service.list('u1');

    expect(findMany.mock.calls[0][0].orderBy).toEqual([
      { dueDate: { sort: 'asc', nulls: 'last' } },
      { priority: 'desc' },
      { createdAt: 'asc' },
    ]);
  });

  it('adds project and parent to the task view, with the subtask progress', async () => {
    findMany.mockResolvedValue([
      row(),
      row({
        id: 't2',
        parentId: 't1',
        subtasks: [],
        parent: { id: 't1', title: 'Padre' },
      }),
    ]);

    const [task, subtask] = await service.list('u1');

    expect(task).toMatchObject({
      id: 't1',
      project: { id: 'p1', name: 'Proyecto' },
      parent: null,
      subtaskProgress: { done: 1, total: 2 },
    });
    expect(subtask).toMatchObject({
      id: 't2',
      parentId: 't1',
      parent: { id: 't1', title: 'Padre' },
      subtaskProgress: { done: 0, total: 0 },
    });
    expect(task).not.toHaveProperty('subtasks');
  });
});
