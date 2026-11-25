import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { MembersService } from '../members/members.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { LabelDto } from './dto/label.dto.js';

export interface LabelView {
  id: string;
  name: string;
  /** How many tasks carry it (handy for the management screen). */
  taskCount: number;
}

const labelInclude = {
  _count: { select: { tasks: true } },
} satisfies Prisma.LabelInclude;

function toView(
  label: Prisma.LabelGetPayload<{ include: typeof labelInclude }>,
): LabelView {
  return { id: label.id, name: label.name, taskCount: label._count.tasks };
}

/**
 * Labels of a project. Any member can list and create them (so tagging a task
 * with something new needs no detour); only the owner renames or deletes, as
 * that affects every task that carries the label. Deleting a label only takes
 * it off the tasks.
 */
@Injectable()
export class LabelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly members: MembersService,
  ) {}

  async list(projectId: string, userId: string): Promise<LabelView[]> {
    await this.members.requireMember(projectId, userId);
    const labels = await this.prisma.label.findMany({
      where: { projectId },
      include: labelInclude,
      orderBy: { name: 'asc' },
    });
    return labels.map(toView);
  }

  async create(
    projectId: string,
    userId: string,
    dto: LabelDto,
  ): Promise<LabelView> {
    await this.members.requireWritableMember(projectId, userId);
    await this.assertNameFree(projectId, dto.name);
    const label = await this.prisma.label.create({
      data: { projectId, name: dto.name },
      include: labelInclude,
    });
    return toView(label);
  }

  async rename(
    projectId: string,
    labelId: string,
    userId: string,
    dto: LabelDto,
  ): Promise<LabelView> {
    await this.members.requireWritableOwner(projectId, userId);
    await this.getLabel(projectId, labelId);
    await this.assertNameFree(projectId, dto.name, labelId);
    const label = await this.prisma.label.update({
      where: { id: labelId },
      data: { name: dto.name },
      include: labelInclude,
    });
    return toView(label);
  }

  async remove(
    projectId: string,
    labelId: string,
    userId: string,
  ): Promise<void> {
    await this.members.requireWritableOwner(projectId, userId);
    await this.getLabel(projectId, labelId);
    await this.prisma.label.delete({ where: { id: labelId } });
  }

  /** Scoped by project, so a label id from another project is just a 404. */
  private async getLabel(projectId: string, labelId: string): Promise<void> {
    const label = await this.prisma.label.findFirst({
      where: { id: labelId, projectId },
      select: { id: true },
    });
    if (!label) {
      throw new NotFoundException('Etiqueta no encontrada');
    }
  }

  /** "Bug" and "bug" are the same label for the people using them. */
  private async assertNameFree(
    projectId: string,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const same = await this.prisma.label.findFirst({
      where: {
        projectId,
        name: { equals: name, mode: 'insensitive' },
        ...(exceptId && { id: { not: exceptId } }),
      },
      select: { id: true },
    });
    if (same) {
      throw new ConflictException('Ya existe una etiqueta con ese nombre');
    }
  }
}
