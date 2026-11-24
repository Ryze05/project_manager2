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
import { LabelDto } from './dto/label.dto.js';
import { LabelsService, type LabelView } from './labels.service.js';

@ApiTags('labels')
@ApiBearerAuth()
@Controller('projects/:projectId/labels')
export class LabelsController {
  constructor(private readonly labels: LabelsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar las etiquetas del proyecto' })
  list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<LabelView[]> {
    return this.labels.list(projectId, user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una etiqueta (cualquier miembro)' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: LabelDto,
    @CurrentUser() user: AuthUser,
  ): Promise<LabelView> {
    return this.labels.create(projectId, user.id, dto);
  }

  @Patch(':labelId')
  @ApiOperation({ summary: 'Renombrar una etiqueta (solo propietario)' })
  rename(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
    @Body() dto: LabelDto,
    @CurrentUser() user: AuthUser,
  ): Promise<LabelView> {
    return this.labels.rename(projectId, labelId, user.id, dto);
  }

  @Delete(':labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Borrar una etiqueta, quitándola de sus tareas (solo propietario)',
  })
  remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.labels.remove(projectId, labelId, user.id);
  }
}
