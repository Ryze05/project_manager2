import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class InviteDto {
  @ApiProperty({
    example: 'pablo@example.com',
    description: 'Email de un usuario ya registrado',
  })
  @IsEmail()
  email!: string;
}
