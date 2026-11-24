import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';
import { AddMemberDto } from './dto/add-member.dto.js';
import { MembersService, type MemberView } from './members.service.js';

@ApiTags('members')
@ApiBearerAuth()
@Controller('projects/:projectId/members')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar los miembros del proyecto' })
  list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<MemberView[]> {
    return this.members.list(projectId, user.id);
  }

  @Post()
  @ApiOperation({
    summary: 'Añadir un miembro por email (solo propietario)',
  })
  add(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: AuthUser,
  ): Promise<MemberView> {
    return this.members.add(projectId, user.id, dto.email);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quitar un miembro (solo propietario)' })
  remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.members.remove(projectId, user.id, userId);
  }
}
