import { Injectable, NotFoundException } from '@nestjs/common';
import { ActivityType, type Prisma } from '../generated/prisma/client.js';
import { MembersService } from '../members/members.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ActivityQueryDto } from './dto/activity-query.dto.js';

export interface ActivityView {
  id: string;
  type: ActivityType;
  createdAt: Date;
  actor: { id: string; name: string };
  /** null for member events. `deleted` is true once the task no longer exists. */
  task: {
    id: string;
    title: string;
    isSubtask: boolean;
    deleted: boolean;
  } | null;
  data: Prisma.JsonValue;
}

export interface ActivityPage {
  items: ActivityView[];
  /** Pass it as `cursor` for the next (older) page; null on the last one. */
  nextCursor: string | null;
}

const DEFAULT_LIMIT = 50;

/**
 * The history of one task: its own events, plus (when it is a parent) the
 * creation and completion of its subtasks. The rest of what happens to a
 * subtask (priority, date, comments...) stays in the subtask's own history.
 */
function forTask(taskId: string): Prisma.ActivityWhereInput {
  return {
    OR: [
      { taskId },
      { parentId: taskId, type: ActivityType.TASK_CREATED },
      {
        parentId: taskId,
        type: ActivityType.STATUS_CHANGED,
        data: { path: ['to'], equals: 'DONE' },
      },
    ],
  };
}

/** Reads the history. Writing lives in `activity.ts`, called by the services that make the changes. */
@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersService,
  ) {}

  /** Newest first. Any member can read it; outsiders get 404 like everywhere else. */
  async list(
    projectId: string,
    userId: string,
    query: ActivityQueryDto,
  ): Promise<ActivityPage> {
    await this.members.requireMember(projectId, userId);
    const limit = query.limit ?? DEFAULT_LIMIT;

    if (query.cursor) {
      // A cursor from another project must not work as a probe.
      const known = await this.prisma.activity.findFirst({
        where: { id: query.cursor, projectId },
        select: { id: true },
      });
      if (!known) throw new NotFoundException('Evento no encontrado');
    }

    const rows = await this.prisma.activity.findMany({
      where: {
        projectId,
        ...(query.actorId && { actorId: query.actorId }),
        ...(query.taskId && forTask(query.taskId)),
      },
      include: { actor: { select: { id: true, name: true } } },
      // The id breaks ties: one edit writes several events with the same timestamp.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
    });
    const page = rows.slice(0, limit);

    // A task's events outlive it, so ask which of them still exist.
    const taskIds = [
      ...new Set(page.flatMap((r) => (r.taskId ? [r.taskId] : []))),
    ];
    const alive = new Set(
      (
        await this.prisma.task.findMany({
          where: { id: { in: taskIds } },
          select: { id: true },
        })
      ).map((t) => t.id),
    );

    return {
      items: page.map((r) => ({
        id: r.id,
        type: r.type,
        createdAt: r.createdAt,
        actor: r.actor,
        task: r.taskId
          ? {
              id: r.taskId,
              title: r.taskTitle ?? '',
              isSubtask: r.isSubtask,
              deleted: !alive.has(r.taskId),
            }
          : null,
        data: r.data,
      })),
      nextCursor: rows.length > limit ? page[page.length - 1].id : null,
    };
  }
}
