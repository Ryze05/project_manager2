import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectRole } from '../generated/prisma/client.js';
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
    await this.requireOwner(projectId, requesterId);

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

    const { role } = await this.prisma.projectMember.create({
      data: { userId: user.id, projectId, role: ProjectRole.MEMBER },
    });
    return { id: user.id, name: user.name, email: user.email, role };
  }

  async remove(
    projectId: string,
    requesterId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.requireOwner(projectId, requesterId);

    const target = await this.prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: targetUserId, projectId } },
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
    await this.prisma.$transaction([
      this.prisma.task.updateMany({
        where: { projectId, assigneeId: targetUserId },
        data: { assigneeId: null },
      }),
      this.prisma.projectMember.delete({
        where: { userId_projectId: { userId: targetUserId, projectId } },
      }),
    ]);
  }
}
