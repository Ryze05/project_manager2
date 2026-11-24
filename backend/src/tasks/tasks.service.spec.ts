import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TasksService } from './tasks.service.js';
import { ProjectRole } from '../generated/prisma/client.js';
import type { MembersService } from '../members/members.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('TasksService', () => {
  const create = vi.fn();
  const findMany = vi.fn();
  const findFirst = vi.fn();
  const findUnique = vi.fn();
  const update = vi.fn();
  const del = vi.fn();
  const transaction = vi.fn();
  const requireMember = vi.fn();
  const isMember = vi.fn();

  // The interactive transaction runs its callback with a client exposing the
  // same task mocks, so assertions on create/update work inside and outside it.
  const tx = { task: { create, update } };

  const service = new TasksService(
    {
      task: { create, findMany, findFirst, findUnique, update, delete: del },
      $transaction: transaction,
    } as unknown as PrismaService,
    { requireMember, isMember } as unknown as MembersService,
  );

  const createdAt = new Date('2026-01-01');
  const include = {
    assignee: { select: { id: true, name: true, email: true } },
    subtasks: {
      select: {
        status: true,
        assignee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    },
  };

  /** A Task row as Prisma returns it with `include`. */
  const row = (overrides = {}) => ({
    id: 't1',
    title: 'Tarea',
    description: null,
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: null,
    projectId: 'p1',
    parentId: null,
    creatorId: 'u1',
    assigneeId: null,
    assignee: null,
    subtasks: [],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  });

  /** What the API returns for that row. */
  const view = (overrides = {}) => ({
    id: 't1',
    title: 'Tarea',
    description: null,
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: null,
    projectId: 'p1',
    parentId: null,
    creatorId: 'u1',
    assignee: null,
    subtaskProgress: { done: 0, total: 0 },
    subtaskAssignees: [],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  });

  const asMember = () =>
    requireMember.mockResolvedValue({ role: ProjectRole.MEMBER });
  const asOwner = () =>
    requireMember.mockResolvedValue({ role: ProjectRole.OWNER });

  beforeEach(() => {
    vi.resetAllMocks();
    transaction.mockImplementation(async (fn: (client: typeof tx) => unknown) =>
      fn(tx),
    );
  });

  describe('create', () => {
    it('creates the task for the caller and returns the view', async () => {
      asMember();
      create.mockResolvedValue(row());

      const result = await service.create('p1', 'u1', { title: 'Tarea' });

      expect(create).toHaveBeenCalledWith({
        data: {
          title: 'Tarea',
          description: undefined,
          priority: undefined,
          dueDate: undefined,
          assigneeId: undefined,
          projectId: 'p1',
          creatorId: 'u1',
        },
        include,
      });
      expect(result).toEqual(view());
    });

    it('turns the ISO due date into a Date', async () => {
      asMember();
      create.mockResolvedValue(row());

      await service.create('p1', 'u1', {
        title: 'T',
        dueDate: '2026-12-31',
      });

      expect(create.mock.calls[0][0].data.dueDate).toEqual(
        new Date('2026-12-31'),
      );
    });

    it('accepts an assignee who is a project member', async () => {
      asMember();
      isMember.mockResolvedValue(true);
      create.mockResolvedValue(
        row({
          assigneeId: 'u2',
          assignee: { id: 'u2', name: 'Pablo', email: 'p@x.com' },
        }),
      );

      const result = await service.create('p1', 'u1', {
        title: 'T',
        assigneeId: 'u2',
      });

      expect(isMember).toHaveBeenCalledWith('p1', 'u2');
      expect(result.assignee).toEqual({
        id: 'u2',
        name: 'Pablo',
        email: 'p@x.com',
      });
    });

    it('rejects an assignee who is not a member with 400', async () => {
      asMember();
      isMember.mockResolvedValue(false);

      await expect(
        service.create('p1', 'u1', { title: 'T', assigneeId: 'stranger' }),
      ).rejects.toThrow(BadRequestException);
      expect(create).not.toHaveBeenCalled();
    });

    it('does not check membership when there is no assignee', async () => {
      asMember();
      create.mockResolvedValue(row());

      await service.create('p1', 'u1', { title: 'T', assigneeId: null });

      expect(isMember).not.toHaveBeenCalled();
    });

    it('is denied to non-members', async () => {
      requireMember.mockRejectedValue(new NotFoundException());

      await expect(service.create('p1', 'x', { title: 'T' })).rejects.toThrow(
        NotFoundException,
      );
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe('board', () => {
    it('queries only top-level tasks, ordered by priority, due date, age', async () => {
      asMember();
      findMany.mockResolvedValue([]);

      await service.board('p1', 'u1');

      expect(findMany).toHaveBeenCalledWith({
        where: { projectId: 'p1', parentId: null },
        include,
        orderBy: [
          { priority: 'desc' },
          { dueDate: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'asc' },
        ],
      });
    });

    it('returns the three columns, even when empty', async () => {
      asMember();
      findMany.mockResolvedValue([]);

      await expect(service.board('p1', 'u1')).resolves.toEqual({
        TODO: [],
        IN_PROGRESS: [],
        DONE: [],
      });
    });

    it('puts each task in its status column, keeping the query order', async () => {
      asMember();
      findMany.mockResolvedValue([
        row({ id: 'a', status: 'TODO' }),
        row({ id: 'b', status: 'DONE' }),
        row({ id: 'c', status: 'TODO' }),
        row({ id: 'd', status: 'IN_PROGRESS' }),
      ]);

      const board = await service.board('p1', 'u1');

      expect(board.TODO.map((t) => t.id)).toEqual(['a', 'c']);
      expect(board.IN_PROGRESS.map((t) => t.id)).toEqual(['d']);
      expect(board.DONE.map((t) => t.id)).toEqual(['b']);
    });

    it('computes subtask progress from the subtasks, never stored', async () => {
      asMember();
      findMany.mockResolvedValue([
        row({
          subtasks: [
            { status: 'DONE' },
            { status: 'DONE' },
            { status: 'TODO' },
            { status: 'IN_PROGRESS' },
          ],
        }),
      ]);

      const board = await service.board('p1', 'u1');

      expect(board.TODO[0].subtaskProgress).toEqual({ done: 2, total: 4 });
    });

    it('lists each subtask assignee once, oldest subtask first, skipping unassigned ones', async () => {
      asMember();
      const ana = { id: 'a', name: 'Ana' };
      const luis = { id: 'l', name: 'Luis' };
      findMany.mockResolvedValue([
        row({
          subtasks: [
            { status: 'DONE', assignee: ana },
            { status: 'TODO', assignee: null },
            { status: 'TODO', assignee: luis },
            { status: 'TODO', assignee: ana },
          ],
        }),
      ]);

      const board = await service.board('p1', 'u1');

      expect(board.TODO[0].subtaskAssignees).toEqual([ana, luis]);
    });

    it('has no subtask assignees when there are no subtasks', async () => {
      asMember();
      findMany.mockResolvedValue([row()]);

      const board = await service.board('p1', 'u1');

      expect(board.TODO[0].subtaskAssignees).toEqual([]);
    });

    it('does not leak raw columns (assigneeId, subtasks) into the cards', async () => {
      asMember();
      findMany.mockResolvedValue([row({ assigneeId: 'u2' })]);

      const [card] = (await service.board('p1', 'u1')).TODO;

      expect(card).not.toHaveProperty('assigneeId');
      expect(card).not.toHaveProperty('subtasks');
    });

    it('is denied to non-members', async () => {
      requireMember.mockRejectedValue(new NotFoundException());

      await expect(service.board('p1', 'x')).rejects.toThrow(NotFoundException);
      expect(findMany).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('looks the task up scoped to the project', async () => {
      asMember();
      findFirst.mockResolvedValue(row());

      await expect(service.findOne('p1', 't1', 'u1')).resolves.toEqual(view());
      expect(findFirst).toHaveBeenCalledWith({
        where: { id: 't1', projectId: 'p1' },
        include,
      });
    });

    it('404s when the task is not in that project', async () => {
      asMember();
      findFirst.mockResolvedValue(null);

      await expect(service.findOne('p1', 'other', 'u1')).rejects.toThrow(
        'Tarea no encontrada',
      );
    });

    it('returns a subtask the same way, exposing its parentId', async () => {
      asMember();
      findFirst.mockResolvedValue(row({ id: 's1', parentId: 't1' }));

      const result = await service.findOne('p1', 's1', 'u1');

      expect(result.parentId).toBe('t1');
    });
  });

  describe('update', () => {
    it('moves a task between columns by changing status', async () => {
      asMember();
      findFirst.mockResolvedValue(row());
      update.mockResolvedValue(row({ status: 'IN_PROGRESS' }));

      const result = await service.update('p1', 't1', 'u1', {
        status: 'IN_PROGRESS',
      });

      expect(update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { status: 'IN_PROGRESS' },
        include,
      });
      expect(result.status).toBe('IN_PROGRESS');
    });

    it('leaves omitted fields out of the update (undefined = untouched)', async () => {
      asMember();
      findFirst.mockResolvedValue(row());
      update.mockResolvedValue(row());

      await service.update('p1', 't1', 'u1', { title: 'Nuevo' });

      const { data } = update.mock.calls[0][0];
      expect(data.title).toBe('Nuevo');
      for (const untouched of [
        'description',
        'priority',
        'status',
        'dueDate',
        'assigneeId',
      ]) {
        expect(data[untouched]).toBeUndefined();
      }
    });

    it('clears description, due date and assignee when they are null', async () => {
      asMember();
      findFirst.mockResolvedValue(row());
      update.mockResolvedValue(row());

      await service.update('p1', 't1', 'u1', {
        description: null,
        dueDate: null,
        assigneeId: null,
      });

      const { data } = update.mock.calls[0][0];
      expect(data.description).toBeNull();
      expect(data.dueDate).toBeNull();
      expect(data.assigneeId).toBeNull();
      expect(isMember).not.toHaveBeenCalled();
    });

    it('turns a new ISO due date into a Date', async () => {
      asMember();
      findFirst.mockResolvedValue(row());
      update.mockResolvedValue(row());

      await service.update('p1', 't1', 'u1', { dueDate: '2027-01-15' });

      expect(update.mock.calls[0][0].data.dueDate).toEqual(
        new Date('2027-01-15'),
      );
    });

    it('rejects reassigning to a non-member with 400', async () => {
      asMember();
      findFirst.mockResolvedValue(row());
      isMember.mockResolvedValue(false);

      await expect(
        service.update('p1', 't1', 'u1', { assigneeId: 'stranger' }),
      ).rejects.toThrow(BadRequestException);
      expect(update).not.toHaveBeenCalled();
    });

    it('404s for a task that is not in the project', async () => {
      asMember();
      findFirst.mockResolvedValue(null);

      await expect(
        service.update('p1', 'other', 'u1', { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
      expect(update).not.toHaveBeenCalled();
    });

    it('is denied to non-members', async () => {
      requireMember.mockRejectedValue(new NotFoundException());

      await expect(
        service.update('p1', 't1', 'x', { title: 'X' }),
      ).rejects.toThrow(NotFoundException);
      expect(findFirst).not.toHaveBeenCalled();
    });
  });

  describe('createSubtask', () => {
    it('creates the subtask under the parent, copying its project', async () => {
      asMember();
      findFirst.mockResolvedValue(row({ id: 'parent', status: 'TODO' }));
      create.mockResolvedValue(row({ id: 's1', parentId: 'parent' }));

      const result = await service.createSubtask('p1', 'parent', 'u2', {
        title: 'Sub',
      });

      expect(findFirst).toHaveBeenCalledWith({
        where: { id: 'parent', projectId: 'p1' },
        include,
      });
      expect(create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Sub',
          projectId: 'p1',
          parentId: 'parent',
          creatorId: 'u2',
        }),
        include,
      });
      expect(result.parentId).toBe('parent');
    });

    it('leaves the parent alone when it is not done', async () => {
      asMember();
      findFirst.mockResolvedValue(row({ id: 'parent', status: 'IN_PROGRESS' }));
      create.mockResolvedValue(row({ parentId: 'parent' }));

      await service.createSubtask('p1', 'parent', 'u1', { title: 'Sub' });

      expect(update).not.toHaveBeenCalled();
    });

    it('sends a DONE parent back to IN_PROGRESS in the same transaction', async () => {
      asMember();
      findFirst.mockResolvedValue(row({ id: 'parent', status: 'DONE' }));
      create.mockResolvedValue(row({ parentId: 'parent' }));

      await service.createSubtask('p1', 'parent', 'u1', { title: 'Sub' });

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledWith({
        where: { id: 'parent' },
        data: { status: 'IN_PROGRESS' },
      });
      expect(create).toHaveBeenCalledTimes(1);
    });

    it('rejects a parent that is itself a subtask (one level only) with 400', async () => {
      asMember();
      findFirst.mockResolvedValue(row({ id: 'sub', parentId: 'top' }));

      await expect(
        service.createSubtask('p1', 'sub', 'u1', { title: 'Nieta' }),
      ).rejects.toThrow('Una subtarea no puede tener subtareas');
      expect(transaction).not.toHaveBeenCalled();
      expect(create).not.toHaveBeenCalled();
    });

    it('404s when the parent is not in the project', async () => {
      asMember();
      findFirst.mockResolvedValue(null);

      await expect(
        service.createSubtask('p1', 'nope', 'u1', { title: 'Sub' }),
      ).rejects.toThrow(NotFoundException);
      expect(create).not.toHaveBeenCalled();
    });

    it('gives the subtask its own assignee, who must be a member', async () => {
      asMember();
      findFirst.mockResolvedValue(row({ id: 'parent', assigneeId: 'u9' }));
      isMember.mockResolvedValue(false);

      await expect(
        service.createSubtask('p1', 'parent', 'u1', {
          title: 'Sub',
          assigneeId: 'stranger',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(isMember).toHaveBeenCalledWith('p1', 'stranger');
      expect(create).not.toHaveBeenCalled();
    });

    it('does not touch a DONE parent when the request is rejected', async () => {
      asMember();
      findFirst.mockResolvedValue(row({ id: 'parent', status: 'DONE' }));
      isMember.mockResolvedValue(false);

      await expect(
        service.createSubtask('p1', 'parent', 'u1', {
          title: 'Sub',
          assigneeId: 'stranger',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(update).not.toHaveBeenCalled();
    });

    it('is denied to non-members', async () => {
      requireMember.mockRejectedValue(new NotFoundException());

      await expect(
        service.createSubtask('p1', 'parent', 'x', { title: 'Sub' }),
      ).rejects.toThrow(NotFoundException);
      expect(findFirst).not.toHaveBeenCalled();
    });
  });

  describe('listSubtasks', () => {
    it("lists the parent's subtasks, oldest first, scoped to the project", async () => {
      asMember();
      findFirst.mockResolvedValue(row({ id: 'parent' }));
      findMany.mockResolvedValue([
        row({ id: 's1', parentId: 'parent' }),
        row({ id: 's2', parentId: 'parent', status: 'DONE' }),
      ]);

      const result = await service.listSubtasks('p1', 'parent', 'u1');

      expect(findMany).toHaveBeenCalledWith({
        where: { projectId: 'p1', parentId: 'parent' },
        include,
        orderBy: { createdAt: 'asc' },
      });
      expect(result.map((t) => t.id)).toEqual(['s1', 's2']);
    });

    it('404s when the parent is not in the project', async () => {
      asMember();
      findFirst.mockResolvedValue(null);

      await expect(service.listSubtasks('p1', 'nope', 'u1')).rejects.toThrow(
        NotFoundException,
      );
      expect(findMany).not.toHaveBeenCalled();
    });

    it('is denied to non-members', async () => {
      requireMember.mockRejectedValue(new NotFoundException());

      await expect(service.listSubtasks('p1', 'parent', 'x')).rejects.toThrow(
        NotFoundException,
      );
      expect(findMany).not.toHaveBeenCalled();
    });
  });

  describe('update: rules between a task and its subtasks', () => {
    it('refuses to complete a task that has pending subtasks (409)', async () => {
      asMember();
      findFirst.mockResolvedValue(
        row({ subtasks: [{ status: 'DONE' }, { status: 'TODO' }] }),
      );

      await expect(
        service.update('p1', 't1', 'u1', { status: 'DONE' }),
      ).rejects.toThrow(ConflictException);
      expect(transaction).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it('counts IN_PROGRESS subtasks as pending too', async () => {
      asMember();
      findFirst.mockResolvedValue(
        row({ subtasks: [{ status: 'IN_PROGRESS' }] }),
      );

      await expect(
        service.update('p1', 't1', 'u1', { status: 'DONE' }),
      ).rejects.toThrow(
        'No se puede completar la tarea mientras tenga subtareas',
      );
    });

    it('lets a task be completed once all its subtasks are done', async () => {
      asMember();
      findFirst.mockResolvedValue(
        row({ subtasks: [{ status: 'DONE' }, { status: 'DONE' }] }),
      );
      update.mockResolvedValue(row({ status: 'DONE' }));

      const result = await service.update('p1', 't1', 'u1', {
        status: 'DONE',
      });

      expect(result.status).toBe('DONE');
    });

    it('lets a task without subtasks be completed', async () => {
      asMember();
      findFirst.mockResolvedValue(row({ subtasks: [] }));
      update.mockResolvedValue(row({ status: 'DONE' }));

      await expect(
        service.update('p1', 't1', 'u1', { status: 'DONE' }),
      ).resolves.toBeDefined();
    });

    it('still allows pending subtasks when the task is not being completed', async () => {
      asMember();
      findFirst.mockResolvedValue(row({ subtasks: [{ status: 'TODO' }] }));
      update.mockResolvedValue(row({ status: 'IN_PROGRESS' }));

      await expect(
        service.update('p1', 't1', 'u1', { status: 'IN_PROGRESS' }),
      ).resolves.toBeDefined();
    });

    it('reopening a subtask whose parent is DONE sends the parent to IN_PROGRESS, atomically', async () => {
      asMember();
      findFirst.mockResolvedValue(
        row({ id: 's1', parentId: 'parent', status: 'DONE' }),
      );
      findUnique.mockResolvedValue({ id: 'parent', status: 'DONE' });
      update.mockResolvedValue(row({ id: 's1', status: 'TODO' }));

      await service.update('p1', 's1', 'u1', { status: 'TODO' });

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenNthCalledWith(1, {
        where: { id: 'parent' },
        data: { status: 'IN_PROGRESS' },
      });
      expect(update.mock.calls[1][0].where).toEqual({ id: 's1' });
      expect(update.mock.calls[1][0].data.status).toBe('TODO');
    });

    it('does not touch a parent that is not DONE', async () => {
      asMember();
      findFirst.mockResolvedValue(
        row({ id: 's1', parentId: 'parent', status: 'DONE' }),
      );
      findUnique.mockResolvedValue({ id: 'parent', status: 'IN_PROGRESS' });
      update.mockResolvedValue(row({ id: 's1' }));

      await service.update('p1', 's1', 'u1', { status: 'IN_PROGRESS' });

      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0].where).toEqual({ id: 's1' });
    });

    it('never completes the parent when its last subtask is completed', async () => {
      asMember();
      findFirst.mockResolvedValue(
        row({ id: 's1', parentId: 'parent', status: 'TODO' }),
      );
      update.mockResolvedValue(row({ id: 's1', status: 'DONE' }));

      await service.update('p1', 's1', 'u1', { status: 'DONE' });

      expect(findUnique).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledTimes(1);
      expect(update.mock.calls[0][0].where).toEqual({ id: 's1' });
    });

    it('does not look the parent up unless a DONE subtask is being reopened', async () => {
      asMember();
      update.mockResolvedValue(row());

      for (const [existing, dto] of [
        [row({ parentId: 'p', status: 'TODO' }), { status: 'IN_PROGRESS' }],
        [row({ parentId: 'p', status: 'DONE' }), { title: 'solo título' }],
        [row({ parentId: 'p', status: 'DONE' }), { status: 'DONE' }],
        [row({ parentId: null, status: 'DONE' }), { status: 'TODO' }],
      ] as const) {
        findFirst.mockResolvedValue(existing);
        await service.update('p1', 't1', 'u1', dto);
      }

      expect(findUnique).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('lets the owner delete a task created by someone else', async () => {
      asOwner();
      findFirst.mockResolvedValue(row({ creatorId: 'someone-else' }));

      await service.remove('p1', 't1', 'owner');

      expect(del).toHaveBeenCalledWith({ where: { id: 't1' } });
    });

    it('lets a member delete a task they created', async () => {
      asMember();
      findFirst.mockResolvedValue(row({ creatorId: 'u2' }));

      await service.remove('p1', 't1', 'u2');

      expect(del).toHaveBeenCalledWith({ where: { id: 't1' } });
    });

    it('forbids a member from deleting a task created by someone else', async () => {
      asMember();
      findFirst.mockResolvedValue(row({ creatorId: 'someone-else' }));

      await expect(service.remove('p1', 't1', 'u2')).rejects.toThrow(
        ForbiddenException,
      );
      expect(del).not.toHaveBeenCalled();
    });

    it('404s before checking permissions when the task is not in the project', async () => {
      asMember();
      findFirst.mockResolvedValue(null);

      await expect(service.remove('p1', 'other', 'u2')).rejects.toThrow(
        NotFoundException,
      );
      expect(del).not.toHaveBeenCalled();
    });

    it('is denied to non-members', async () => {
      requireMember.mockRejectedValue(new NotFoundException());

      await expect(service.remove('p1', 't1', 'x')).rejects.toThrow(
        NotFoundException,
      );
      expect(findFirst).not.toHaveBeenCalled();
    });
  });
});
