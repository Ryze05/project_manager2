import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { TaskPriority, TaskStatus } from '../../generated/prisma/client.js';
import { CreateTaskDto } from './create-task.dto.js';

/**
 * Same fields as creation, all optional, plus `status` (how a task moves
 * between board columns). There is deliberately no `parentId`: a subtask cannot
 * be moved to another parent, nor a task turned into a subtask.
 *
 * `PartialType` adds `@IsOptional()` to every field, which also accepts `null`.
 * That is wanted for description, dueDate and assigneeId (null clears them) but
 * not for title, priority and status, so those are redeclared here with
 * `@ValidateIf(value !== undefined)`: omitted means "leave as is", null is a 400.
 */
export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ['title', 'priority'] as const),
) {
  @ApiPropertyOptional({ example: 'Nuevo título' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ enum: TaskPriority })
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ enum: TaskStatus })
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}
