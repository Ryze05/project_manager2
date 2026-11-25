import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';
import { ChangeRoleDto } from './dto/change-role.dto.js';
import { MembersService, type MemberView } from './members.service.js';

@ApiTags('members')
@ApiBearerAuth()
@Controller('projects/:projectId')
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get('members')
  @ApiOperation({ summary: 'Listar los miembros del proyecto' })
  list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<MemberView[]> {
    return this.members.list(projectId, user.id);
  }

  @Patch('members/:userId')
  @ApiOperation({
    summary:
      'Promover a propietario o degradar a miembro (cualquier propietario)',
  })
  changeRole(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() user: AuthUser,
  ): Promise<MemberView> {
    return this.members.changeRole(projectId, user.id, userId, dto.role);
  }

  @Delete('members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Quitar un miembro (solo propietario)' })
  remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.members.remove(projectId, user.id, userId);
  }

  @Post('leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Abandonar el proyecto (el último propietario no puede: promueve a otro antes)',
  })
  leave(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.members.leave(projectId, user.id);
  }
}
