import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { TaskPriority } from '../../generated/prisma/client.js';

/**
 * Optional fields accept `null` (IsOptional lets it through) so that a PATCH
 * can clear them. A new task always starts as TODO, so there is no `status`.
 */
export class CreateTaskDto {
  @ApiProperty({ example: 'Diseñar la base de datos' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({ enum: TaskPriority, default: TaskPriority.MEDIUM })
  // Not IsOptional: that would also let `null` through, and priority is not nullable.
  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2026-12-31',
    description: 'Fecha ISO 8601, con o sin hora',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Id de un miembro del proyecto',
  })
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Ids de etiquetas del proyecto (solo las tareas llevan etiquetas, no las subtareas)',
  })
  // Not IsOptional: that would also let `null` through, and the list is not nullable.
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  labelIds?: string[];
}
