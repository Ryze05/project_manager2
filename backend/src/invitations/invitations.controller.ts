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
import { InviteDto } from './dto/invite.dto.js';
import {
  InvitationsService,
  type MyInvitationView,
  type ProjectInvitationView,
} from './invitations.service.js';

/** Owners' side: invite people to a project and manage the pending ones. */
@ApiTags('invitations')
@ApiBearerAuth()
@Controller('projects/:projectId/invitations')
export class ProjectInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  @ApiOperation({
    summary: 'Invitar a un usuario registrado por email (solo propietario)',
  })
  invite(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: InviteDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ProjectInvitationView> {
    return this.invitations.invite(projectId, user.id, dto.email);
  }

  @Get()
  @ApiOperation({
    summary: 'Invitaciones pendientes del proyecto (propietario)',
  })
  list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ProjectInvitationView[]> {
    return this.invitations.listForProject(projectId, user.id);
  }

  @Delete(':invitationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancelar una invitación pendiente (propietario)' })
  cancel(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.invitations.cancel(projectId, invitationId, user.id);
  }
}

/** The invited user's side: my inbox. */
@ApiTags('invitations')
@ApiBearerAuth()
@Controller('me/invitations')
export class MyInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get()
  @ApiOperation({ summary: 'Mis invitaciones pendientes' })
  list(@CurrentUser() user: AuthUser): Promise<MyInvitationView[]> {
    return this.invitations.listMine(user.id);
  }

  @Post(':invitationId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aceptar una invitación y entrar al proyecto' })
  accept(
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<{ projectId: string }> {
    return this.invitations.accept(invitationId, user.id);
  }

  @Post(':invitationId/decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Rechazar una invitación' })
  decline(
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.invitations.decline(invitationId, user.id);
  }
}
