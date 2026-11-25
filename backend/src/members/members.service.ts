import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivityType, ProjectRole } from '../generated/prisma/client.js';
import { recordActivity } from '../activity/activity.js';
import type { ProjectMember } from '../generated/prisma/client.js';
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

  async add(
    projectId: string,
    requesterId: string,
    email: string,
  ): Promise<MemberView> {
    await this.requireWritableOwner(projectId, requesterId);

    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new NotFoundException(
        'No hay ningún usuario registrado con ese email',
      );
    }

    const existing = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: user.id, projectId } },
    });
    if (existing) {
      throw new ConflictException('El usuario ya es miembro del proyecto');
    }

    const { role } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.projectMember.create({
        data: { userId: user.id, projectId, role: ProjectRole.MEMBER },
      });
      await recordActivity(tx, [
        {
          type: ActivityType.MEMBER_ADDED,
          projectId,
          actorId: requesterId,
          data: { name: user.name },
        },
      ]);
      return created;
    });
    return { id: user.id, name: user.name, email: user.email, role };
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
        'El propietario no puede ser quitado del proyecto',
      );
    }

    // Task.assigneeId points at User, not ProjectMember, so the DB won't
    // unassign by itself: do it here, atomically with the removal.
    await this.prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: { projectId, assigneeId: targetUserId },
        data: { assigneeId: null },
      });
      await tx.projectMember.delete({
        where: { userId_projectId: { userId: targetUserId, projectId } },
      });
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
}
