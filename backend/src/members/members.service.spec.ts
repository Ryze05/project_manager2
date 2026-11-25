import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MembersService } from './members.service.js';
import { ProjectRole } from '../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { UsersService } from '../users/users.service.js';

describe('MembersService', () => {
  const findUnique = vi.fn();
  const findMany = vi.fn();
  const create = vi.fn();
  const del = vi.fn();
  const updateMany = vi.fn();
  const createMany = vi.fn();
  const projectFindUnique = vi.fn();
  const transaction = vi.fn();
  const findByEmail = vi.fn();

  const service = new MembersService(
    {
      projectMember: { findUnique, findMany, create, delete: del },
      task: { updateMany },
      project: { findUnique: projectFindUnique },
      $transaction: transaction,
    } as unknown as PrismaService,
    { findByEmail } as unknown as UsersService,
  );

  const owner = { userId: 'owner', projectId: 'p1', role: ProjectRole.OWNER };
  const member = {
    userId: 'member',
    projectId: 'p1',
    role: ProjectRole.MEMBER,
  };

  // The interactive transaction runs its callback with the same mocks.
  const tx = {
    projectMember: { create, delete: del },
    task: { updateMany },
    activity: { createMany },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    projectFindUnique.mockResolvedValue({ archivedAt: null });
    transaction.mockImplementation(async (fn: (client: typeof tx) => unknown) =>
      fn(tx),
    );
  });

  describe('requireMember', () => {
    it('looks the membership up by the composite key', async () => {
      findUnique.mockResolvedValue(member);
      await expect(service.requireMember('p1', 'member')).resolves.toBe(member);
      expect(findUnique).toHaveBeenCalledWith({
        where: { userId_projectId: { userId: 'member', projectId: 'p1' } },
      });
    });

    it('throws 404 (not 403) for a non-member', async () => {
      findUnique.mockResolvedValue(null);
      await expect(service.requireMember('p1', 'x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('requireWritableMember / requireWritableOwner', () => {
    it('refuses with 409 when the project is archived', async () => {
      findUnique.mockResolvedValue(owner);
      projectFindUnique.mockResolvedValue({ archivedAt: new Date() });
      await expect(
        service.requireWritableMember('p1', 'owner'),
      ).rejects.toThrow(ConflictException);
      await expect(service.requireWritableOwner('p1', 'owner')).rejects.toThrow(
        ConflictException,
      );
    });

    it('lets an active project through', async () => {
      findUnique.mockResolvedValue(member);
      await expect(service.requireWritableMember('p1', 'member')).resolves.toBe(
        member,
      );
    });

    it('keeps 404 for outsiders and 403 for members before the archive check', async () => {
      projectFindUnique.mockResolvedValue({ archivedAt: new Date() });
      findUnique.mockResolvedValue(null);
      await expect(service.requireWritableMember('p1', 'x')).rejects.toThrow(
        NotFoundException,
      );
      findUnique.mockResolvedValue(member);
      await expect(
        service.requireWritableOwner('p1', 'member'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('requireOwner', () => {
    it('lets the owner through', async () => {
      findUnique.mockResolvedValue(owner);
      await expect(service.requireOwner('p1', 'owner')).resolves.toBe(owner);
    });

    it('throws 403 for a plain member', async () => {
      findUnique.mockResolvedValue(member);
      await expect(service.requireOwner('p1', 'member')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws 404 for a non-member', async () => {
      findUnique.mockResolvedValue(null);
      await expect(service.requireOwner('p1', 'x')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('isMember', () => {
    it('is true for a member and queries the composite key', async () => {
      findUnique.mockResolvedValue({ userId: 'member' });
      await expect(service.isMember('p1', 'member')).resolves.toBe(true);
      expect(findUnique).toHaveBeenCalledWith({
        where: { userId_projectId: { userId: 'member', projectId: 'p1' } },
        select: { userId: true },
      });
    });

    it('is false (and does not throw) for a non-member', async () => {
      findUnique.mockResolvedValue(null);
      await expect(service.isMember('p1', 'x')).resolves.toBe(false);
    });
  });

  describe('list', () => {
    it('flattens each membership into id, name, email and role', async () => {
      findUnique.mockResolvedValue(member);
      findMany.mockResolvedValue([
        {
          userId: 'owner',
          role: ProjectRole.OWNER,
          user: { id: 'owner', name: 'Marta', email: 'marta@x.com' },
        },
      ]);

      await expect(service.list('p1', 'member')).resolves.toEqual([
        { id: 'owner', name: 'Marta', email: 'marta@x.com', role: 'OWNER' },
      ]);
    });

    it('is denied to non-members', async () => {
      findUnique.mockResolvedValue(null);
      await expect(service.list('p1', 'x')).rejects.toThrow(NotFoundException);
      expect(findMany).not.toHaveBeenCalled();
    });
  });

  describe('add', () => {
    const pablo = { id: 'u2', name: 'Pablo', email: 'pablo@x.com' };

    it('adds a registered user as MEMBER', async () => {
      findUnique.mockResolvedValueOnce(owner).mockResolvedValueOnce(null);
      findByEmail.mockResolvedValue(pablo);
      create.mockResolvedValue({ role: ProjectRole.MEMBER });

      await expect(service.add('p1', 'owner', pablo.email)).resolves.toEqual({
        ...pablo,
        role: 'MEMBER',
      });
      expect(create).toHaveBeenCalledWith({
        data: { userId: 'u2', projectId: 'p1', role: ProjectRole.MEMBER },
      });
    });

    it('rejects an email that belongs to nobody with a clear 404', async () => {
      findUnique.mockResolvedValue(owner);
      findByEmail.mockResolvedValue(null);

      await expect(service.add('p1', 'owner', 'no@x.com')).rejects.toThrow(
        'No hay ningún usuario registrado con ese email',
      );
      expect(create).not.toHaveBeenCalled();
    });

    it('rejects a user who is already a member with 409', async () => {
      findUnique.mockResolvedValueOnce(owner).mockResolvedValueOnce(member);
      findByEmail.mockResolvedValue(pablo);

      await expect(service.add('p1', 'owner', pablo.email)).rejects.toThrow(
        ConflictException,
      );
      expect(create).not.toHaveBeenCalled();
    });

    it('is owner-only', async () => {
      findUnique.mockResolvedValue(member);
      await expect(service.add('p1', 'member', 'a@x.com')).rejects.toThrow(
        ForbiddenException,
      );
      expect(findByEmail).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('unassigns their tasks and deletes the membership in one transaction', async () => {
      findUnique.mockResolvedValueOnce(owner).mockResolvedValueOnce(member);
      findUnique.mockReset();
      findUnique
        .mockResolvedValueOnce(owner)
        .mockResolvedValueOnce({ ...member, user: { name: 'Pablo' } });

      await service.remove('p1', 'owner', 'member');

      expect(updateMany).toHaveBeenCalledWith({
        where: { projectId: 'p1', assigneeId: 'member' },
        data: { assigneeId: null },
      });
      expect(del).toHaveBeenCalledWith({
        where: { userId_projectId: { userId: 'member', projectId: 'p1' } },
      });
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            type: 'MEMBER_REMOVED',
            projectId: 'p1',
            actorId: 'owner',
            data: { name: 'Pablo' },
          }),
        ],
      });
    });

    it('refuses to remove the owner', async () => {
      findUnique.mockResolvedValueOnce(owner).mockResolvedValueOnce(owner);

      await expect(service.remove('p1', 'owner', 'owner')).rejects.toThrow(
        'El propietario no puede ser quitado del proyecto',
      );
      expect(transaction).not.toHaveBeenCalled();
    });

    it('404s when the target is not a member', async () => {
      findUnique.mockResolvedValueOnce(owner).mockResolvedValueOnce(null);

      await expect(service.remove('p1', 'owner', 'ghost')).rejects.toThrow(
        NotFoundException,
      );
      expect(transaction).not.toHaveBeenCalled();
    });

    it('is owner-only', async () => {
      findUnique.mockResolvedValue(member);

      await expect(service.remove('p1', 'member', 'other')).rejects.toThrow(
        ForbiddenException,
      );
      expect(transaction).not.toHaveBeenCalled();
    });
  });
});
