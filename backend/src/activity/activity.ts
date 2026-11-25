import type { Prisma } from '../generated/prisma/client.js';
import { ActivityType } from '../generated/prisma/client.js';

/** Anything with `activity.createMany`: the Prisma client or a transaction of it. */
export interface ActivityDb {
  activity: {
    createMany: (args: { data: Prisma.ActivityCreateManyInput[] }) => unknown;
  };
}

export interface ActivityEntry {
  type: ActivityType;
  projectId: string;
  actorId: string;
  /** The task the event is about (null for members). Kept without FK, with its title, to outlive the task. */
  task?: {
    id: string;
    title: string;
    isSubtask: boolean;
    /** For a subtask: its parent, so the parent's history can show it. */
    parentId?: string | null;
  };
  data?: Prisma.InputJsonObject;
}

/**
 * Writes events. Call it with the transaction client, in the same transaction as
 * the change itself, so there are no changes without a record nor the reverse.
 */
export async function recordActivity(
  db: ActivityDb,
  entries: ActivityEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  await db.activity.createMany({
    data: entries.map((e) => ({
      type: e.type,
      projectId: e.projectId,
      actorId: e.actorId,
      taskId: e.task?.id ?? null,
      taskTitle: e.task?.title ?? null,
      isSubtask: e.task?.isSubtask ?? false,
      parentId: e.task?.parentId ?? null,
      ...(e.data && { data: e.data }),
    })),
  });
}

/** What the diff needs to know about a task. */
export interface TaskSnapshot {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  parentId: string | null;
  projectId: string;
  assignee: { id: string; name: string } | null;
  labels: { id: string; name: string }[];
}

const day = (date: Date | null) =>
  date ? date.toISOString().slice(0, 10) : null;

/**
 * One event per field that actually changed (comparing before and after, not
 * the request, so sending the same value again records nothing). Labels give
 * one event per label added or removed.
 */
export function taskChanges(
  before: TaskSnapshot,
  after: TaskSnapshot,
  actorId: string,
): ActivityEntry[] {
  const base = {
    projectId: after.projectId,
    actorId,
    task: {
      id: after.id,
      title: after.title,
      isSubtask: after.parentId !== null,
      parentId: after.parentId,
    },
  };
  const entries: ActivityEntry[] = [];
  const changed = (type: ActivityType, data?: Prisma.InputJsonObject) =>
    entries.push({ ...base, type, ...(data && { data }) });

  if (before.title !== after.title) {
    changed(ActivityType.TITLE_CHANGED, {
      from: before.title,
      to: after.title,
    });
  }
  if (before.description !== after.description) {
    changed(ActivityType.DESCRIPTION_CHANGED);
  }
  if (before.status !== after.status) {
    changed(ActivityType.STATUS_CHANGED, {
      from: before.status,
      to: after.status,
    });
  }
  if (before.priority !== after.priority) {
    changed(ActivityType.PRIORITY_CHANGED, {
      from: before.priority,
      to: after.priority,
    });
  }
  if (before.dueDate?.getTime() !== after.dueDate?.getTime()) {
    changed(ActivityType.DUE_DATE_CHANGED, {
      from: day(before.dueDate),
      to: day(after.dueDate),
    });
  }
  if (before.assignee?.id !== after.assignee?.id) {
    changed(ActivityType.ASSIGNEE_CHANGED, {
      from: before.assignee?.name ?? null,
      to: after.assignee?.name ?? null,
    });
  }
  const had = new Set(before.labels.map((l) => l.id));
  const has = new Set(after.labels.map((l) => l.id));
  for (const label of after.labels) {
    if (!had.has(label.id))
      changed(ActivityType.LABEL_ADDED, { label: label.name });
  }
  for (const label of before.labels) {
    if (!has.has(label.id))
      changed(ActivityType.LABEL_REMOVED, { label: label.name });
  }
  return entries;
}
