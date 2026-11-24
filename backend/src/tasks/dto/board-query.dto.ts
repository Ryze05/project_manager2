import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';
import { TaskPriority } from '../../generated/prisma/client.js';

/** `?label=a&label=b` arrives as an array, `?label=a` as a string: always an array. */
const toArray = ({ value }: { value: unknown }): unknown =>
  value === undefined || Array.isArray(value) ? value : [value];

export const DUE_FILTERS = ['overdue', 'week', 'none'] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

/**
 * Board filters. Different filters combine with AND; several values of the
 * same filter (labels, priorities) combine with OR.
 */
export class BoardQueryDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Id de etiqueta (repetible)',
  })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsUUID('all', { each: true })
  label?: string[];

  @ApiPropertyOptional({
    description:
      'Id de un usuario (sus tareas y las que tengan una subtarea suya) o "none" (sin responsable)',
  })
  @IsOptional()
  @Matches(
    /^(none|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
    {
      message: 'assignee must be a user id or "none"',
    },
  )
  assignee?: string;

  @ApiPropertyOptional({ enum: TaskPriority, isArray: true })
  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsEnum(TaskPriority, { each: true })
  priority?: TaskPriority[];

  @ApiPropertyOptional({
    enum: DUE_FILTERS,
    description:
      'overdue = vencidas sin terminar; week = hoy y los 7 dias siguientes; none = sin fecha',
  })
  @IsOptional()
  @IsIn(DUE_FILTERS)
  due?: DueFilter;
}
