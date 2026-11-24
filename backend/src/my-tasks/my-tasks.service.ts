import { Injectable } from '@nestjs/common';
import { Prisma, TaskStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { taskInclude, toView, type TaskView } from '../tasks/tasks.service.js';

export interface MyTaskView extends TaskView {
  project: { id: string; name: string };
  /** null for a regular task; the parent task for a subtask. */
  parent: { id: string; title: string } | null;
}

const myTaskInclude = {
  ...taskInclude,
  project: { select: { id: true, name: true } },
  parent: { select: { id: true, title: true } },
} satisfies Prisma.TaskInclude;

/** "Mis tareas": everything assigned to the user across their projects. */
@Injectable()
export class MyTasksService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Tasks and subtasks assigned to the user, in projects where they are still
   * a member. Pending and in-progress by default; `includeDone` adds the done
   * ones. Earliest due date first (none last), then highest priority, then
   * oldest.
   */
  async list(userId: string, includeDone = false): Promise<MyTaskView[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        assigneeId: userId,
        project: { members: { some: { userId } } },
        ...(includeDone ? {} : { status: { not: TaskStatus.DONE } }),
      },
      include: myTaskInclude,
      orderBy: [
        { dueDate: { sort: 'asc', nulls: 'last' } },
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    return tasks.map((task) => ({
      ...toView(task),
      project: task.project,
      parent: task.parent,
    }));
  }
}
