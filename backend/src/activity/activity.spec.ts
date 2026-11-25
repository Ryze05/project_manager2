import { ActivityType } from '../generated/prisma/client.js';
import { recordActivity, taskChanges, type TaskSnapshot } from './activity.js';

describe('taskChanges', () => {
  const base: TaskSnapshot = {
    id: 't1',
    title: 'Tarea',
    description: null,
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: null,
    parentId: null,
    projectId: 'p1',
    assignee: null,
    labels: [],
  };
  const diff = (after: Partial<TaskSnapshot>) =>
    taskChanges(base, { ...base, ...after }, 'u1');

  it('records nothing when nothing changed', () => {
    expect(diff({})).toEqual([]);
    // Same instant in a different Date object is not a change either.
    expect(
      taskChanges(
        { ...base, dueDate: new Date('2026-03-01') },
        { ...base, dueDate: new Date('2026-03-01') },
        'u1',
      ),
    ).toEqual([]);
  });

  it('writes one event per changed field, with readable values', () => {
    const entries = diff({
      status: 'DONE',
      priority: 'HIGH',
      title: 'Nueva',
      dueDate: new Date('2026-03-01'),
      assignee: { id: 'u2', name: 'Pablo' },
    });
    expect(entries.map((e) => [e.type, e.data])).toEqual([
      [ActivityType.TITLE_CHANGED, { from: 'Tarea', to: 'Nueva' }],
      [ActivityType.STATUS_CHANGED, { from: 'TODO', to: 'DONE' }],
      [ActivityType.PRIORITY_CHANGED, { from: 'MEDIUM', to: 'HIGH' }],
      [ActivityType.DUE_DATE_CHANGED, { from: null, to: '2026-03-01' }],
      [ActivityType.ASSIGNEE_CHANGED, { from: null, to: 'Pablo' }],
    ]);
    expect(
      entries.every((e) => e.actorId === 'u1' && e.projectId === 'p1'),
    ).toBe(true);
  });

  it('does not store the description, only that it changed', () => {
    const [entry] = diff({ description: 'texto largo' });
    expect(entry.type).toBe(ActivityType.DESCRIPTION_CHANGED);
    expect(entry.data).toBeUndefined();
  });

  it('writes one event per label added or removed', () => {
    const before = {
      ...base,
      labels: [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
    };
    const after = {
      ...base,
      labels: [
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ],
    };
    expect(
      taskChanges(before, after, 'u1').map((e) => [e.type, e.data]),
    ).toEqual([
      [ActivityType.LABEL_ADDED, { label: 'C' }],
      [ActivityType.LABEL_REMOVED, { label: 'A' }],
    ]);
  });

  it('marks subtasks', () => {
    const [entry] = diff({ parentId: 'parent', status: 'DONE' });
    expect(entry.task).toEqual({
      id: 't1',
      title: 'Tarea',
      isSubtask: true,
      parentId: 'parent',
    });
  });
});

describe('recordActivity', () => {
  it('does not touch the database without entries', async () => {
    const createMany = vi.fn();
    await recordActivity({ activity: { createMany } }, []);
    expect(createMany).not.toHaveBeenCalled();
  });
});
