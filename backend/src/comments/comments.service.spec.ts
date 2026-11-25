import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommentsService } from './comments.service.js';
import { ProjectRole } from '../generated/prisma/client.js';
import type { MembersService } from '../members/members.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('CommentsService', () => {
  const taskFindFirst = vi.fn();
  const create = vi.fn();
  const findMany = vi.fn();
  const commentFindFirst = vi.fn();
  const update = vi.fn();
  const del = vi.fn();
  const createMany = vi.fn();
  const transaction = vi.fn();
  const requireMember = vi.fn();

  const service = new CommentsService(
    {
      task: { findFirst: taskFindFirst },
      comment: {
        create,
        findMany,
        findFirst: commentFindFirst,
        update,
        delete: del,
      },
      $transaction: transaction,
    } as unknown as PrismaService,
    {
      requireMember,
      requireWritableMember: requireMember,
    } as unknown as MembersService,
  );

  // The interactive transaction runs its callback with the same comment mocks.
  const tx = { comment: { create }, activity: { createMany } };

  const createdAt = new Date('2026-01-01');
  const include = { author: { select: { id: true, name: true, email: true } } };
  const author = { id: 'u1', name: 'Ana', email: 'ana@x.com' };

  /** A Comment row as Prisma returns it with `include`. */
  const row = (overrides = {}) => ({
    id: 'c1',
    content: 'Hola',
    createdAt,
    editedAt: null,
    taskId: 't1',
    authorId: 'u1',
    author,
    ...overrides,
  });

  const asMember = () =>
    requireMember.mockResolvedValue({ role: ProjectRole.MEMBER });
  const asOwner = () =>
    requireMember.mockResolvedValue({ role: ProjectRole.OWNER });
  const taskExists = () =>
    taskFindFirst.mockResolvedValue({
      id: 't1',
      title: 'Tarea',
      parentId: null,
    });

  beforeEach(() => {
    vi.resetAllMocks();
    transaction.mockImplementation(async (fn: (client: typeof tx) => unknown) =>
      fn(tx),
    );
  });

  describe('create', () => {
    it('creates the comment for the caller and returns the view', async () => {
      asMember();
      taskExists();
      create.mockResolvedValue(row());

      const result = await service.create('p1', 't1', 'u1', {
        content: 'Hola',
      });

      expect(taskFindFirst).toHaveBeenCalledWith({
        where: { id: 't1', projectId: 'p1' },
        select: { id: true, title: true, parentId: true },
      });
      expect(create).toHaveBeenCalledWith({
        data: { content: 'Hola', taskId: 't1', authorId: 'u1' },
        include,
      });
      expect(createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            type: 'COMMENT_ADDED',
            projectId: 'p1',
            actorId: 'u1',
            taskId: 't1',
            taskTitle: 'Tarea',
            isSubtask: false,
          }),
        ],
      });
      expect(result).toEqual({
        id: 'c1',
        content: 'Hola',
        createdAt,
        editedAt: null,
        taskId: 't1',
        author,
      });
      expect(result).not.toHaveProperty('authorId');
    });

    it('404s when the task is not in the project', async () => {
      asMember();
      taskFindFirst.mockResolvedValue(null);

      await expect(
        service.create('p1', 'other', 'u1', { content: 'x' }),
      ).rejects.toThrow('Tarea no encontrada');
      expect(create).not.toHaveBeenCalled();
    });

    it('is denied to non-members before touching the task', async () => {
      requireMember.mockRejectedValue(new NotFoundException());

      await expect(
        service.create('p1', 't1', 'x', { content: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(taskFindFirst).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns the thread of the task, oldest first', async () => {
      asMember();
      taskExists();
      findMany.mockResolvedValue([row({ id: 'c1' }), row({ id: 'c2' })]);

      const result = await service.list('p1', 't1', 'u1');

      expect(findMany).toHaveBeenCalledWith({
        where: { taskId: 't1' },
        include,
        orderBy: { createdAt: 'asc' },
      });
      expect(result.map((c) => c.id)).toEqual(['c1', 'c2']);
    });

    it('404s when the task is not in the project', async () => {
      asMember();
      taskFindFirst.mockResolvedValue(null);

      await expect(service.list('p1', 'other', 'u1')).rejects.toThrow(
        NotFoundException,
      );
      expect(findMany).not.toHaveBeenCalled();
    });

    it('is denied to non-members', async () => {
      requireMember.mockRejectedValue(new NotFoundException());

      await expect(service.list('p1', 't1', 'x')).rejects.toThrow(
        NotFoundException,
      );
      expect(findMany).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('lets the author edit and stamps editedAt', async () => {
      asMember();
      taskExists();
      commentFindFirst.mockResolvedValue(row());
      update.mockResolvedValue(row({ content: 'Nuevo', editedAt: createdAt }));

      const before = Date.now();
      const result = await service.update('p1', 't1', 'c1', 'u1', {
        content: 'Nuevo',
      });

      expect(commentFindFirst).toHaveBeenCalledWith({
        where: { id: 'c1', taskId: 't1' },
        include,
      });
      const { where, data } = update.mock.calls[0][0];
      expect(where).toEqual({ id: 'c1' });
      expect(data.content).toBe('Nuevo');
      expect(data.editedAt).toBeInstanceOf(Date);
      expect(data.editedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.content).toBe('Nuevo');
    });

    it('forbids anyone else, owner included (403)', async () => {
      asOwner();
      taskExists();
      commentFindFirst.mockResolvedValue(row({ authorId: 'someone-else' }));

      await expect(
        service.update('p1', 't1', 'c1', 'owner', { content: 'Nuevo' }),
      ).rejects.toThrow(ForbiddenException);
      expect(update).not.toHaveBeenCalled();
    });

    it('404s when the comment belongs to another task', async () => {
      asMember();
      taskExists();
      commentFindFirst.mockResolvedValue(null);

      await expect(
        service.update('p1', 't1', 'c9', 'u1', { content: 'x' }),
      ).rejects.toThrow('Comentario no encontrado');
      expect(update).not.toHaveBeenCalled();
    });

    it('404s before checking the author when the task is not in the project', async () => {
      asMember();
      taskFindFirst.mockResolvedValue(null);

      await expect(
        service.update('p1', 'other', 'c1', 'u1', { content: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(commentFindFirst).not.toHaveBeenCalled();
    });

    it('is denied to non-members', async () => {
      requireMember.mockRejectedValue(new NotFoundException());

      await expect(
        service.update('p1', 't1', 'c1', 'x', { content: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('lets the author delete their own comment', async () => {
      asMember();
      taskExists();
      commentFindFirst.mockResolvedValue(row({ authorId: 'u2' }));

      await service.remove('p1', 't1', 'c1', 'u2');

      expect(del).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });

    it("lets the owner delete anyone's comment", async () => {
      asOwner();
      taskExists();
      commentFindFirst.mockResolvedValue(row({ authorId: 'someone-else' }));

      await service.remove('p1', 't1', 'c1', 'owner');

      expect(del).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });

    it("forbids a member from deleting someone else's comment (403)", async () => {
      asMember();
      taskExists();
      commentFindFirst.mockResolvedValue(row({ authorId: 'someone-else' }));

      await expect(service.remove('p1', 't1', 'c1', 'u2')).rejects.toThrow(
        ForbiddenException,
      );
      expect(del).not.toHaveBeenCalled();
    });

    it('404s before checking permissions when the comment is not in the task', async () => {
      asMember();
      taskExists();
      commentFindFirst.mockResolvedValue(null);

      await expect(service.remove('p1', 't1', 'c9', 'u2')).rejects.toThrow(
        NotFoundException,
      );
      expect(del).not.toHaveBeenCalled();
    });

    it('is denied to non-members', async () => {
      requireMember.mockRejectedValue(new NotFoundException());

      await expect(service.remove('p1', 't1', 'c1', 'x')).rejects.toThrow(
        NotFoundException,
      );
      expect(del).not.toHaveBeenCalled();
    });
  });
});
