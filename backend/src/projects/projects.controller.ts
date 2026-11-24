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
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { ProjectsService, type ProjectView } from './projects.service.js';

@ApiTags('projects')
@ApiBearerAuth()
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un proyecto (quedas como propietario)' })
  create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ProjectView> {
    return this.projects.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar mis proyectos' })
  findMine(@CurrentUser() user: AuthUser): Promise<ProjectView[]> {
    return this.projects.findMine(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un proyecto (solo miembros)' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<ProjectView> {
    return this.projects.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un proyecto (solo propietario)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: AuthUser,
  ): Promise<ProjectView> {
    return this.projects.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Borrar un proyecto (solo propietario)' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.projects.remove(id, user.id);
  }
}
