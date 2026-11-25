import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRole } from '../generated/prisma/client.js';
import { MembersService } from '../members/members.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateProjectDto } from './dto/create-project.dto.js';
import type { UpdateProjectDto } from './dto/update-project.dto.js';

export interface ProjectView {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Null while active; an archived project is read-only. */
  archivedAt: Date | null;
  /** Role of the requesting user in this project. */
  role: ProjectRole;
  memberCount: number;
}

interface ProjectWithCount {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;
  _count: { members: number };
}

const withMemberCount = {
  _count: { select: { members: true } },
} as const;

function toView(project: ProjectWithCount, role: ProjectRole): ProjectView {
  const { _count, ...fields } = project;
  return { ...fields, role, memberCount: _count.members };
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersService,
  ) {}

  /** Creates the project and its OWNER membership atomically (nested create). */
  async create(userId: string, dto: CreateProjectDto): Promise<ProjectView> {
    const project = await this.prisma.project.create({
      data: {
        name: dto.name,
        description: dto.description,
        members: { create: { userId, role: ProjectRole.OWNER } },
      },
      include: withMemberCount,
    });
    return toView(project, ProjectRole.OWNER);
  }

  async findMine(userId: string): Promise<ProjectView[]> {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId },
      include: { project: { include: withMemberCount } },
      orderBy: { project: { updatedAt: 'desc' } },
    });
    return memberships.map(({ project, role }) => toView(project, role));
  }

  async findOne(projectId: string, userId: string): Promise<ProjectView> {
    const { role } = await this.members.requireMember(projectId, userId);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: withMemberCount,
    });
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }
    return toView(project, role);
  }

  async update(
    projectId: string,
    userId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectView> {
    const { role } = await this.members.requireWritableOwner(projectId, userId);
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { name: dto.name, description: dto.description },
      include: withMemberCount,
    });
    return toView(project, role);
  }

  /** Owner only. Idempotent: archiving an archived project changes nothing. */
  async archive(projectId: string, userId: string): Promise<ProjectView> {
    const { role } = await this.members.requireOwner(projectId, userId);
    await this.prisma.project.updateMany({
      where: { id: projectId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    return this.view(projectId, role);
  }

  /** Owner only. Idempotent, like archive. */
  async unarchive(projectId: string, userId: string): Promise<ProjectView> {
    const { role } = await this.members.requireOwner(projectId, userId);
    await this.prisma.project.updateMany({
      where: { id: projectId, archivedAt: { not: null } },
      data: { archivedAt: null },
    });
    return this.view(projectId, role);
  }

  private async view(
    projectId: string,
    role: ProjectRole,
  ): Promise<ProjectView> {
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: withMemberCount,
    });
    return toView(project, role);
  }

  /** Members, tasks, subtasks and comments go away through DB cascades. */
  async remove(projectId: string, userId: string): Promise<void> {
    await this.members.requireOwner(projectId, userId);
    await this.prisma.project.delete({ where: { id: projectId } });
  }
}
