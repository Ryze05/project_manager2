import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ActivityQueryDto {
  @ApiPropertyOptional({
    description: 'Solo los eventos de esta tarea (o subtarea)',
  })
  @IsOptional()
  @IsUUID('all')
  taskId?: string;

  @ApiPropertyOptional({ description: 'Solo los eventos de este usuario' })
  @IsOptional()
  @IsUUID('all')
  actorId?: string;

  @ApiPropertyOptional({
    description: 'Id del ultimo evento recibido: devuelve los anteriores',
  })
  @IsOptional()
  @IsUUID('all')
  cursor?: string;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
