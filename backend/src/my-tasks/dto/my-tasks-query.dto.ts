import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class MyTasksQueryDto {
  @ApiPropertyOptional({
    description: 'Incluir también las tareas hechas (por defecto no)',
    default: false,
  })
  // The global implicit conversion would turn the string "false" into true
  // (Boolean("false")), so the raw query value is read and mapped by hand.
  // Anything else is left as is and rejected by @IsBoolean (400).
  @Transform(({ obj }: { obj: Record<string, unknown> }) => {
    const raw = obj.includeDone;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return raw;
  })
  @IsOptional()
  @IsBoolean()
  includeDone?: boolean;
}
