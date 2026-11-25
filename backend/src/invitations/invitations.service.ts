import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { recordActivity } from '../activity/activity.js';
import { ActivityType, ProjectRole } from '../generated/prisma/client.js';
import { MembersService } from '../members/members.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';

/** A pending invitation as the owners of the project see it. */
export interface ProjectInvitationView {
  id: string;
  createdAt: Date;
  user: { id: string; name: string; email: string };
  invitedBy: { id: string; name: string };
}

/** A pending invitation as the invited user sees it. */
export interface MyInvitationView {
  id: string;
  createdAt: Date;
  project: { id: string; name: string };
  invitedBy: { id: string; name: string };
}

const person = { select: { id: true, name: true } } as const;
const personWithEmail = {
  select: { id: true, name: true, email: true },
} as const;

/**
 * Invitations to registered users. A row exists only while pending: accepting,
 * declining or cancelling deletes it (accepting also creates the membership).
 */
@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersService,
    private readonly users: UsersService,
  ) {}

  async invite(
    projectId: string,
    requesterId: string,
    email: string,
  ): Promise<ProjectInvitationView> {
    await this.members.requireWritableOwner(projectId, requesterId);

    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new NotFoundException(
        'No hay ningún usuario registrado con ese email',
      );
    }
    if (await this.members.isMember(projectId, user.id)) {
      throw new ConflictException('El usuario ya es miembro del proyecto');
    }
    const pending = await this.prisma.invitation.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
      select: { id: true },
    });
    if (pending) {
      throw new ConflictException(
        'Ya hay una invitación pendiente para ese usuario',
      );
    }

    return this.prisma.invitation.create({
      data: { projectId, userId: user.id, invitedById: requesterId },
      select: {
        id: true,
        createdAt: true,
        user: personWithEmail,
        invitedBy: person,
      },
    });
  }

  /** Pending invitations of a project, oldest first. Owners only. */
  async listForProject(
    projectId: string,
    userId: string,
  ): Promise<ProjectInvitationView[]> {
    await this.members.requireOwner(projectId, userId);
    return this.prisma.invitation.findMany({
      where: { projectId },
      select: {
        id: true,
        createdAt: true,
        user: personWithEmail,
        invitedBy: person,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async cancel(
    projectId: string,
    invitationId: string,
    userId: string,
  ): Promise<void> {
    await this.members.requireWritableOwner(projectId, userId);
    const { count } = await this.prisma.invitation.deleteMany({
      where: { id: invitationId, projectId },
    });
    if (count === 0) {
      throw new NotFoundException('Invitación no encontrada');
    }
  }

  /** My pending invitations, newest first. Those of archived projects are hidden. */
  listMine(userId: string): Promise<MyInvitationView[]> {
    return this.prisma.invitation.findMany({
      where: { userId, project: { archivedAt: null } },
      select: {
        id: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
        invitedBy: person,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  /** Joins the project as a MEMBER. Returns the project id to go to. */
  async accept(
    invitationId: string,
    userId: string,
  ): Promise<{ projectId: string }> {
    const invitation = await this.getMine(invitationId, userId);
    const project = await this.prisma.project.findUnique({
      where: { id: invitation.projectId },
      select: { archivedAt: true },
    });
    if (project?.archivedAt) {
      throw new ConflictException(
        'El proyecto está archivado: no se puede entrar ahora',
      );
    }
    const user = await this.users.findById(userId);

    await this.prisma.$transaction(async (tx) => {
      // Two clicks at once: only the one that deletes the row joins.
      const { count } = await tx.invitation.deleteMany({
        where: { id: invitationId, userId },
      });
      if (count === 0) {
        throw new NotFoundException('Invitación no encontrada');
      }
      await tx.projectMember.create({
        data: {
          userId,
          projectId: invitation.projectId,
          role: ProjectRole.MEMBER,
        },
      });
      await recordActivity(tx, [
        {
          type: ActivityType.INVITATION_ACCEPTED,
          projectId: invitation.projectId,
          actorId: userId,
          data: { name: user?.name ?? '' },
        },
      ]);
    });
    return { projectId: invitation.projectId };
  }

  async decline(invitationId: string, userId: string): Promise<void> {
    const { count } = await this.prisma.invitation.deleteMany({
      where: { id: invitationId, userId },
    });
    if (count === 0) {
      throw new NotFoundException('Invitación no encontrada');
    }
  }

  /** An invitation addressed to this user, or 404 (never reveals others'). */
  private async getMine(invitationId: string, userId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, userId },
    });
    if (!invitation) {
      throw new NotFoundException('Invitación no encontrada');
    }
    return invitation;
  }
}
