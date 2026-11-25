import { Injectable } from '@nestjs/common';
import { TaskStatus } from '../generated/prisma/client.js';
import { MembersService } from '../members/members.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AssigneeMetrics {
  user: { id: string; name: string };
  todo: number;
  inProgress: number;
  done: number;
}

export interface ProjectMetrics {
  /** Top-level tasks only, like the board. */
  tasks: { total: number; todo: number; inProgress: number; done: number };
  subtasks: { total: number; done: number };
  /** Not done and past their due date (UTC days, like the board filter). */
  overdue: number;
  /** Not done and due today or in the next 7 days. */
  dueSoon: number;
  /** Not done and without a responsible. */
  unassigned: number;
  /** Every current member, most pending work first (then by name). */
  byAssignee: AssigneeMetrics[];
}

const DAY = 24 * 60 * 60 * 1000;

/** Read-only numbers of a project, computed on demand (nothing is stored). */
@Injectable()
export class MetricsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersService,
  ) {}

  async get(projectId: string, userId: string): Promise<ProjectMetrics> {
    // Reading is allowed on archived projects too.
    await this.members.requireMember(projectId, userId);

    // Due dates are stored at UTC midnight, so compare against UTC days.
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const afterWeek = new Date(today.getTime() + 8 * DAY);
    const pending = {
      projectId,
      parentId: null,
      status: { not: TaskStatus.DONE },
    };

    const [byStatusAndAssignee, subtaskRows, overdue, dueSoon, members] =
      await Promise.all([
        this.prisma.task.groupBy({
          by: ['assigneeId', 'status'],
          where: { projectId, parentId: null },
          _count: { _all: true },
        }),
        this.prisma.task.groupBy({
          by: ['status'],
          where: { projectId, parentId: { not: null } },
          _count: { _all: true },
        }),
        this.prisma.task.count({
          where: { ...pending, dueDate: { lt: today } },
        }),
        this.prisma.task.count({
          where: { ...pending, dueDate: { gte: today, lt: afterWeek } },
        }),
        this.prisma.projectMember.findMany({
          where: { projectId },
          select: { user: { select: { id: true, name: true } } },
        }),
      ]);

    const tasks = { total: 0, todo: 0, inProgress: 0, done: 0 };
    let unassigned = 0;
    const perUser = new Map<string, AssigneeMetrics>(
      members.map(({ user }) => [
        user.id,
        { user, todo: 0, inProgress: 0, done: 0 },
      ]),
    );
    for (const row of byStatusAndAssignee) {
      const n = row._count._all;
      const key = FIELD[row.status];
      tasks.total += n;
      tasks[key] += n;
      if (row.assigneeId === null) {
        if (row.status !== TaskStatus.DONE) unassigned += n;
      } else if (perUser.has(row.assigneeId)) {
        perUser.get(row.assigneeId)![key] += n;
      }
    }

    const subtasks = { total: 0, done: 0 };
    for (const row of subtaskRows) {
      subtasks.total += row._count._all;
      if (row.status === TaskStatus.DONE) subtasks.done += row._count._all;
    }

    const pendingOf = (m: AssigneeMetrics) => m.todo + m.inProgress;
    const byAssignee = [...perUser.values()].sort(
      (a, b) =>
        pendingOf(b) - pendingOf(a) || a.user.name.localeCompare(b.user.name),
    );

    return { tasks, subtasks, overdue, dueSoon, unassigned, byAssignee };
  }
}

const FIELD = {
  [TaskStatus.TODO]: 'todo',
  [TaskStatus.IN_PROGRESS]: 'inProgress',
  [TaskStatus.DONE]: 'done',
} as const;
