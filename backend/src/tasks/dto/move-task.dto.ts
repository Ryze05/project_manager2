import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsUUID, ValidateIf } from 'class-validator';
import { TaskStatus } from '../../generated/prisma/client.js';

/**
 * Where a card is dropped: the column and its neighbours there. The server
 * works out the position itself, so a stale client cannot corrupt the order.
 */
export class MoveTaskDto {
  @ApiProperty({ enum: TaskStatus })
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'La tarjeta que queda justo encima; ninguna si se suelta arriba del todo',
  })
  // `null` is a valid value (no card above), so IsOptional would be too loose.
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID('all')
  afterTaskId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'La tarjeta que queda justo debajo; ninguna si se suelta al final. Sin ninguna de las dos, va al final',
  })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID('all')
  beforeTaskId?: string | null;
}
