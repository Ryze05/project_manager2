import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProjectRole,
  TaskStatus,
  type TaskPriority,
} from '../generated/prisma/client.js';
import { MembersService } from '../members/members.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateTaskDto } from './dto/create-task.dto.js';
import type { UpdateTaskDto } from './dto/update-task.dto.js';

export interface TaskView {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  projectId: string;
  /** null for a regular task, the parent's id for a subtask. */
  parentId: string | null;
  creatorId: string;
  assignee: { id: string; name: string; email: string } | null;
  /** Computed from the subtasks' states, never stored. */
  subtaskProgress: { done: number; total: number };
  createdAt: Date;
  updatedAt: Date;
}

export type Board = Record<TaskStatus, TaskView[]>;

export const taskInclude = {
  assignee: { select: { id: true, name: true, email: true } },
  subtasks: { select: { status: true } },
} satisfies Prisma.TaskInclude;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export function toView(task: TaskRow): TaskView {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    projectId: task.projectId,
    parentId: task.parentId,
    creatorId: task.creatorId,
    assignee: task.assignee,
    subtaskProgress: {
      done: task.subtasks.filter((s) => s.status === 'DONE').length,
      total: task.subtasks.length,
    },
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

interface CreateFields {
  title: string;
  description: string | null | undefined;
  priority: TaskPriority | undefined;
  dueDate: Date | null | undefined;
  assigneeId: string | null | undefined;
}

/** The fields shared by creating a task and a subtask (and by updating). */
function fieldsOf(dto: CreateTaskDto): CreateFields;
function fieldsOf(dto: UpdateTaskDto): Partial<CreateFields>;
function fieldsOf(dto: CreateTaskDto | UpdateTaskDto): Partial<CreateFields> {
  return {
    title: dto.title,
    description: dto.description,
    priority: dto.priority,
    dueDate: toDate(dto.dueDate),
    assigneeId: dto.assigneeId,
  };
}

/** undefined = leave as is, null = clear, string = set. */
function toDate(value: string | null | undefined): Date | null | undefined {
  return value === undefined || value === null ? value : new Date(value);
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersService,
  ) {}

  async create(
    projectId: string,
    userId: string,
    dto: CreateTaskDto,
  ): Promise<TaskView> {
    await this.members.requireMember(projectId, userId);
    await this.assertAssignable(projectId, dto.assigneeId);

    const task = await this.prisma.task.create({
      data: { ...fieldsOf(dto), projectId, creatorId: userId },
      include: taskInclude,
    });
    return toView(task);
  }

  /**
   * Creates a subtask under a top-level task. Rules (spec):
   * - a subtask cannot have subtasks of its own (one level only);
   * - if the parent is DONE, it goes back to IN_PROGRESS, atomically.
   * The subtask copies the project from its parent, and has its own assignee.
   */
  async createSubtask(
    projectId: string,
    parentId: string,
    userId: string,
    dto: CreateTaskDto,
  ): Promise<TaskView> {
    await this.members.requireMember(projectId, userId);
    const parent = await this.getTask(projectId, parentId);
    if (parent.parentId !== null) {
      throw new BadRequestException('Una subtarea no puede tener subtareas');
    }
    await this.assertAssignable(projectId, dto.assigneeId);

    const subtask = await this.prisma.$transaction(async (tx) => {
      if (parent.status === TaskStatus.DONE) {
        await tx.task.update({
          where: { id: parent.id },
          data: { status: TaskStatus.IN_PROGRESS },
        });
      }
      return tx.task.create({
        data: {
          ...fieldsOf(dto),
          projectId: parent.projectId,
          parentId: parent.id,
          creatorId: userId,
        },
        include: taskInclude,
      });
    });
    return toView(subtask);
  }

  /** Subtasks of a task, oldest first. */
  async listSubtasks(
    projectId: string,
    parentId: string,
    userId: string,
  ): Promise<TaskView[]> {
    await this.members.requireMember(projectId, userId);
    await this.getTask(projectId, parentId);

    const subtasks = await this.prisma.task.findMany({
      where: { projectId, parentId },
      include: taskInclude,
      orderBy: { createdAt: 'asc' },
    });
    return subtasks.map(toView);
  }

  /**
   * The three columns. Subtasks never appear as cards (parentId null only).
   * Each column: highest priority first, then earliest due date (none last),
   * then oldest first.
   */
  async board(projectId: string, userId: string): Promise<Board> {
    await this.members.requireMember(projectId, userId);

    const tasks = await this.prisma.task.findMany({
      where: { projectId, parentId: null },
      include: taskInclude,
      orderBy: [
        { priority: 'desc' },
        { dueDate: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ],
    });

    const board: Board = { TODO: [], IN_PROGRESS: [], DONE: [] };
    for (const task of tasks) {
      board[task.status].push(toView(task));
    }
    return board;
  }

  /** Works for tasks and subtasks alike: both are rows of Task. */
  async findOne(
    projectId: string,
    taskId: string,
    userId: string,
  ): Promise<TaskView> {
    await this.members.requireMember(projectId, userId);
    return toView(await this.getTask(projectId, taskId));
  }

  async update(
    projectId: string,
    taskId: string,
    userId: string,
    dto: UpdateTaskDto,
  ): Promise<TaskView> {
    await this.members.requireMember(projectId, userId);
    const existing = await this.getTask(projectId, taskId);
    await this.assertAssignable(projectId, dto.assigneeId);

    // A task cannot be completed while any of its subtasks is pending.
    if (
      dto.status === TaskStatus.DONE &&
      existing.subtasks.some((s) => s.status !== TaskStatus.DONE)
    ) {
      throw new ConflictException(
        'No se puede completar la tarea mientras tenga subtareas pendientes',
      );
    }

    const parentToReopen = await this.parentToReopen(existing, dto.status);

    // A DONE parent is reopened when one of its subtasks is reopened, and a
    // parent is completed when its last pending subtask is completed. Both
    // happen in the same transaction as the subtask's own update.
    const task = await this.prisma.$transaction(async (tx) => {
      if (parentToReopen) {
        await tx.task.update({
          where: { id: parentToReopen },
          data: { status: TaskStatus.IN_PROGRESS },
        });
      }
      const updated = await tx.task.update({
        where: { id: taskId },
        data: { ...fieldsOf(dto), status: dto.status },
        include: taskInclude,
      });
      if (
        existing.parentId !== null &&
        existing.status !== TaskStatus.DONE &&
        dto.status === TaskStatus.DONE
      ) {
        await this.completeParentIfFinished(tx, existing.parentId);
      }
      return updated;
    });
    return toView(task);
  }

  /**
   * The owner deletes any task; a member only the ones they created.
   * Subtasks and comments go away through DB cascades.
   */
  async remove(
    projectId: string,
    taskId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.members.requireMember(projectId, userId);
    const task = await this.getTask(projectId, taskId);

    if (membership.role !== ProjectRole.OWNER && task.creatorId !== userId) {
      throw new ForbiddenException(
        'Solo puedes borrar las tareas que has creado',
      );
    }
    await this.prisma.task.delete({ where: { id: taskId } });
  }

  /** Scoped by project, so a task id from another project is just a 404. */
  private async getTask(projectId: string, taskId: string): Promise<TaskRow> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
      include: taskInclude,
    });
    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }
    return task;
  }

  /**
   * Called right after a subtask became DONE: when no sibling is pending any
   * more, the parent is completed too. Never touches a parent that is already
   * DONE, and deleting subtasks never goes through here.
   */
  private async completeParentIfFinished(
    tx: Prisma.TransactionClient,
    parentId: string,
  ): Promise<void> {
    const pending = await tx.task.count({
      where: { parentId, status: { not: TaskStatus.DONE } },
    });
    if (pending > 0) return;
    await tx.task.updateMany({
      where: { id: parentId, status: { not: TaskStatus.DONE } },
      data: { status: TaskStatus.DONE },
    });
  }

  /**
   * Reopening a subtask (DONE -> anything else) while its parent is DONE sends
   * the parent back to IN_PROGRESS. Returns the parent's id in that case.
   */
  private async parentToReopen(
    task: TaskRow,
    newStatus: TaskStatus | undefined,
  ): Promise<string | null> {
    const reopening =
      task.parentId !== null &&
      task.status === TaskStatus.DONE &&
      newStatus !== undefined &&
      newStatus !== TaskStatus.DONE;
    if (!reopening) return null;

    const parent = await this.prisma.task.findUnique({
      where: { id: task.parentId as string },
      select: { id: true, status: true },
    });
    return parent?.status === TaskStatus.DONE ? parent.id : null;
  }

  /** null/undefined mean "no assignee"; anything else must be a project member. */
  private async assertAssignable(
    projectId: string,
    assigneeId: string | null | undefined,
  ): Promise<void> {
    if (!assigneeId) return;
    if (!(await this.members.isMember(projectId, assigneeId))) {
      throw new BadRequestException(
        'El responsable debe ser miembro del proyecto',
      );
    }
  }
}
