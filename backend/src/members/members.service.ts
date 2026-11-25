import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType, ProjectRole } from '../generated/prisma/client.js';
import { recordActivity } from '../activity/activity.js';
import type { Prisma, ProjectMember } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';

export interface MemberView {
  id: string;
  name: string;
  email: string;
  role: ProjectRole;
}

const memberUserSelect = { select: { id: true, name: true, email: true } };

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  /**
   * Returns the user's membership or throws 404. A non-member must not be able
   * to tell whether the project exists, so there is no 403 here.
   */
  async requireMember(
    projectId: string,
    userId: string,
  ): Promise<ProjectMember> {
    const membership = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });
    if (!membership) {
      throw new NotFoundException('Proyecto no encontrado');
    }
    return membership;
  }

  /** Like requireMember, but a plain member gets 403. */
  async requireOwner(
    projectId: string,
    userId: string,
  ): Promise<ProjectMember> {
    const membership = await this.requireMember(projectId, userId);
    if (membership.role !== ProjectRole.OWNER) {
      throw new ForbiddenException(
        'Solo el propietario puede realizar esta acción',
      );
    }
    return membership;
  }

  /**
   * Like requireMember, but also refuses (409) when the project is archived:
   * an archived project is read-only. Every write path uses this one.
   */
  async requireWritableMember(
    projectId: string,
    userId: string,
  ): Promise<ProjectMember> {
    const membership = await this.requireMember(projectId, userId);
    await this.assertNotArchived(projectId);
    return membership;
  }

  /** Owner-only version of requireWritableMember (403 before 409). */
  async requireWritableOwner(
    projectId: string,
    userId: string,
  ): Promise<ProjectMember> {
    const membership = await this.requireOwner(projectId, userId);
    await this.assertNotArchived(projectId);
    return membership;
  }

  private async assertNotArchived(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { archivedAt: true },
    });
    if (project?.archivedAt) {
      throw new ConflictException(
        'El proyecto está archivado: desarchívalo para hacer cambios',
      );
    }
  }

  /**
   * Non-throwing check, for validating a user id sent in a request body
   * (e.g. a task assignee). Callers decide which error to raise.
   */
  async isMember(projectId: string, userId: string): Promise<boolean> {
    const membership = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
      select: { userId: true },
    });
    return membership !== null;
  }

  async list(projectId: string, userId: string): Promise<MemberView[]> {
    await this.requireMember(projectId, userId);
    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      include: { user: memberUserSelect },
      orderBy: [{ role: 'asc' }, { user: { name: 'asc' } }],
    });
    return members.map(({ user, role }) => ({ ...user, role }));
  }

  async remove(
    projectId: string,
    requesterId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.requireWritableOwner(projectId, requesterId);

    const target = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: targetUserId, projectId } },
      include: { user: { select: { name: true } } },
    });
    if (!target) {
      throw new NotFoundException('El usuario no es miembro del proyecto');
    }
    if (target.role === ProjectRole.OWNER) {
      throw new ForbiddenException(
        'Un propietario no puede ser quitado: quítale antes el rol de propietario',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await this.dropMembership(tx, projectId, targetUserId);
      await recordActivity(tx, [
        {
          type: ActivityType.MEMBER_REMOVED,
          projectId,
          actorId: requesterId,
          data: { name: target.user.name },
        },
      ]);
    });
  }

  /**
   * Promotes a member to owner or demotes an owner (possibly oneself) to
   * member. Any owner can do it; there must always be at least one owner left.
   * Idempotent: sending the role the user already has changes nothing.
   */
  async changeRole(
    projectId: string,
    requesterId: string,
    targetUserId: string,
    role: ProjectRole,
  ): Promise<MemberView> {
    await this.requireWritableOwner(projectId, requesterId);

    const target = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: targetUserId, projectId } },
      include: { user: memberUserSelect },
    });
    if (!target) {
      throw new NotFoundException('El usuario no es miembro del proyecto');
    }
    const view = { ...target.user, role };
    if (target.role === role) return view;

    await this.prisma.$transaction(async (tx) => {
      // Two owners demoting each other at once must not leave zero owners.
      await this.lockProject(tx, projectId);
      if (role === ProjectRole.MEMBER) {
        await this.assertAnotherOwner(tx, projectId, targetUserId);
      }
      await tx.projectMember.update({
        where: { userId_projectId: { userId: targetUserId, projectId } },
        data: { role },
      });
      await recordActivity(tx, [
        {
          type:
            role === ProjectRole.OWNER
              ? ActivityType.MEMBER_PROMOTED
              : ActivityType.MEMBER_DEMOTED,
          projectId,
          actorId: requesterId,
          data: { name: target.user.name },
        },
      ]);
    });
    return view;
  }

  /**
   * The caller leaves the project. Their tasks are unassigned and their
   * comments stay, like when they are removed. The last owner cannot leave.
   */
  async leave(projectId: string, userId: string): Promise<void> {
    const membership = await this.requireWritableMember(projectId, userId);
    const user = await this.users.findById(userId);

    await this.prisma.$transaction(async (tx) => {
      await this.lockProject(tx, projectId);
      if (membership.role === ProjectRole.OWNER) {
        await this.assertAnotherOwner(tx, projectId, userId);
      }
      await this.dropMembership(tx, projectId, userId);
      await recordActivity(tx, [
        {
          type: ActivityType.MEMBER_LEFT,
          projectId,
          actorId: userId,
          data: { name: user?.name ?? '' },
        },
      ]);
    });
  }

  /**
   * Task.assigneeId points at User, not ProjectMember, so the DB won't
   * unassign by itself: do it here, atomically with the removal.
   */
  private async dropMembership(
    tx: Prisma.TransactionClient,
    projectId: string,
    userId: string,
  ): Promise<void> {
    await tx.task.updateMany({
      where: { projectId, assigneeId: userId },
      data: { assigneeId: null },
    });
    await tx.projectMember.delete({
      where: { userId_projectId: { userId, projectId } },
    });
  }

  /** Serialises role changes and departures of one project. */
  private async lockProject(
    tx: Prisma.TransactionClient,
    projectId: string,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "Project" WHERE id = ${projectId}::uuid FOR UPDATE`;
  }

  private async assertAnotherOwner(
    tx: Prisma.TransactionClient,
    projectId: string,
    leavingUserId: string,
  ): Promise<void> {
    const others = await tx.projectMember.count({
      where: {
        projectId,
        role: ProjectRole.OWNER,
        userId: { not: leavingUserId },
      },
    });
    if (others === 0) {
      throw new ConflictException(
        'Debe quedar al menos un propietario: promueve a otro miembro antes',
      );
    }
  }
}
