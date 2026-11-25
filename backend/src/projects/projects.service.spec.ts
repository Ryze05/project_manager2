import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service.js';
import { ProjectRole } from '../generated/prisma/client.js';
import type { MembersService } from '../members/members.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

describe('ProjectsService', () => {
  const create = vi.fn();
  const findUnique = vi.fn();
  const update = vi.fn();
  const del = vi.fn();
  const findMany = vi.fn();
  const requireMember = vi.fn();
  const requireOwner = vi.fn();

  const service = new ProjectsService(
    {
      project: { create, findUnique, update, delete: del },
      projectMember: { findMany },
    } as unknown as PrismaService,
    {
      requireMember,
      requireOwner,
      requireWritableOwner: requireOwner,
    } as unknown as MembersService,
  );

  const createdAt = new Date('2026-01-01');
  const row = (overrides = {}) => ({
    id: 'p1',
    name: 'Gestor',
    description: null,
    createdAt,
    updatedAt: createdAt,
    _count: { members: 3 },
    ...overrides,
  });
  const view = (overrides = {}) => ({
    id: 'p1',
    name: 'Gestor',
    description: null,
    createdAt,
    updatedAt: createdAt,
    role: ProjectRole.MEMBER,
    memberCount: 3,
    ...overrides,
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('create', () => {
    it('creates the project with the creator as OWNER in one nested create', async () => {
      create.mockResolvedValue(row({ _count: { members: 1 } }));

      const result = await service.create('u1', {
        name: 'Gestor',
        description: 'desc',
      });

      expect(create).toHaveBeenCalledWith({
        data: {
          name: 'Gestor',
          description: 'desc',
          members: { create: { userId: 'u1', role: ProjectRole.OWNER } },
        },
        include: { _count: { select: { members: true } } },
      });
      expect(result).toEqual(view({ role: ProjectRole.OWNER, memberCount: 1 }));
      expect(result).not.toHaveProperty('_count');
    });
  });

  describe('findMine', () => {
    it("lists only the user's projects with their role and member count", async () => {
      findMany.mockResolvedValue([
        { role: ProjectRole.OWNER, project: row() },
        { role: ProjectRole.MEMBER, project: row({ id: 'p2' }) },
      ]);

      const result = await service.findMine('u1');

      expect(findMany.mock.calls[0][0].where).toEqual({ userId: 'u1' });
      expect(result).toEqual([
        view({ role: ProjectRole.OWNER }),
        view({ id: 'p2', role: ProjectRole.MEMBER }),
      ]);
    });
  });

  describe('findOne', () => {
    it("returns the project with the caller's role", async () => {
      requireMember.mockResolvedValue({ role: ProjectRole.MEMBER });
      findUnique.mockResolvedValue(row());

      await expect(service.findOne('p1', 'u1')).resolves.toEqual(view());
      expect(requireMember).toHaveBeenCalledWith('p1', 'u1');
    });

    it('does not even query the project for a non-member', async () => {
      requireMember.mockRejectedValue(new NotFoundException());

      await expect(service.findOne('p1', 'x')).rejects.toThrow(
        NotFoundException,
      );
      expect(findUnique).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('lets the owner update name and description', async () => {
      requireOwner.mockResolvedValue({ role: ProjectRole.OWNER });
      update.mockResolvedValue(row({ name: 'Nuevo' }));

      const result = await service.update('p1', 'u1', { name: 'Nuevo' });

      expect(update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { name: 'Nuevo', description: undefined },
        include: { _count: { select: { members: true } } },
      });
      expect(result).toEqual(view({ name: 'Nuevo', role: ProjectRole.OWNER }));
    });

    it('is denied to plain members', async () => {
      requireOwner.mockRejectedValue(new ForbiddenException());

      await expect(service.update('p1', 'u2', { name: 'X' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('lets the owner delete the project', async () => {
      requireOwner.mockResolvedValue({ role: ProjectRole.OWNER });

      await service.remove('p1', 'u1');

      expect(del).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });

    it('is denied to plain members', async () => {
      requireOwner.mockRejectedValue(new ForbiddenException());

      await expect(service.remove('p1', 'u2')).rejects.toThrow(
        ForbiddenException,
      );
      expect(del).not.toHaveBeenCalled();
    });
  });
});
