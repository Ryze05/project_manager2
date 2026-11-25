import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ProjectRole } from '../../generated/prisma/client.js';

export class ChangeRoleDto {
  @ApiProperty({
    enum: ProjectRole,
    description: 'OWNER promueve al miembro; MEMBER degrada a un propietario',
  })
  @IsEnum(ProjectRole)
  role!: ProjectRole;
}
