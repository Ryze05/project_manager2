import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({
    example: 'pablo@example.com',
    description: 'Email de un usuario ya registrado',
  })
  @IsEmail()
  email!: string;
}
