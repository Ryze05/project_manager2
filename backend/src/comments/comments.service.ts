import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityType,
  Prisma,
  ProjectRole,
} from '../generated/prisma/client.js';
import { recordActivity } from '../activity/activity.js';
import { MembersService } from '../members/members.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateCommentDto } from './dto/create-comment.dto.js';
import type { UpdateCommentDto } from './dto/update-comment.dto.js';

export interface CommentView {
  id: string;
  content: string;
  createdAt: Date;
  /** null until the comment is edited. */
  editedAt: Date | null;
  taskId: string;
  author: { id: string; name: string; email: string };
}

const commentInclude = {
  author: { select: { id: true, name: true, email: true } },
} satisfies Prisma.CommentInclude;

type CommentRow = Prisma.CommentGetPayload<{ include: typeof commentInclude }>;

function toView(comment: CommentRow): CommentView {
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    editedAt: comment.editedAt,
    taskId: comment.taskId,
    author: comment.author,
  };
}

/**
 * Comments on tasks and subtasks alike (both are Task rows). Every method
 * checks, in this order: membership (404 for outsiders), that the task is in
 * the project (404), that the comment belongs to that task (404), and only
 * then the permission for the action (403).
 */
@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersService,
  ) {}

  async create(
    projectId: string,
    taskId: string,
    userId: string,
    dto: CreateCommentDto,
  ): Promise<CommentView> {
    await this.members.requireWritableMember(projectId, userId);
    const task = await this.assertTaskInProject(projectId, taskId);

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: { content: dto.content, taskId, authorId: userId },
        include: commentInclude,
      });
      await recordActivity(tx, [
        {
          type: ActivityType.COMMENT_ADDED,
          projectId,
          actorId: userId,
          task: {
            id: task.id,
            title: task.title,
            isSubtask: task.parentId !== null,
            parentId: task.parentId,
          },
        },
      ]);
      return created;
    });
    return toView(comment);
  }

  /** The thread, oldest comment first. */
  async list(
    projectId: string,
    taskId: string,
    userId: string,
  ): Promise<CommentView[]> {
    await this.members.requireMember(projectId, userId);
    await this.assertTaskInProject(projectId, taskId);

    const comments = await this.prisma.comment.findMany({
      where: { taskId },
      include: commentInclude,
      orderBy: { createdAt: 'asc' },
    });
    return comments.map(toView);
  }

  /** Only the author can edit, not even the owner. Marks `editedAt`. */
  async update(
    projectId: string,
    taskId: string,
    commentId: string,
    userId: string,
    dto: UpdateCommentDto,
  ): Promise<CommentView> {
    await this.members.requireWritableMember(projectId, userId);
    await this.assertTaskInProject(projectId, taskId);
    const comment = await this.getComment(taskId, commentId);

    if (comment.authorId !== userId) {
      throw new ForbiddenException('Solo el autor puede editar su comentario');
    }

    const updated = await this.prisma.comment.update({
      where: { id: commentId },
      data: { content: dto.content, editedAt: new Date() },
      include: commentInclude,
    });
    return toView(updated);
  }

  /** The owner deletes any comment; a member only their own. */
  async remove(
    projectId: string,
    taskId: string,
    commentId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.members.requireWritableMember(
      projectId,
      userId,
    );
    await this.assertTaskInProject(projectId, taskId);
    const comment = await this.getComment(taskId, commentId);

    if (membership.role !== ProjectRole.OWNER && comment.authorId !== userId) {
      throw new ForbiddenException(
        'Solo puedes borrar tus propios comentarios',
      );
    }
    await this.prisma.comment.delete({ where: { id: commentId } });
  }

  /** Scoped by project: a task id from another project is just a 404. */
  private async assertTaskInProject(
    projectId: string,
    taskId: string,
  ): Promise<{ id: string; title: string; parentId: string | null }> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, projectId },
      select: { id: true, title: true, parentId: true },
    });
    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }
    return task;
  }

  /** Scoped by task: a comment id from another task is just a 404. */
  private async getComment(
    taskId: string,
    commentId: string,
  ): Promise<CommentRow> {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, taskId },
      include: commentInclude,
    });
    if (!comment) {
      throw new NotFoundException('Comentario no encontrado');
    }
    return comment;
  }
}
