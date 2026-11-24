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
import { CommentsService, type CommentView } from './comments.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { UpdateCommentDto } from './dto/update-comment.dto.js';

@ApiTags('comments')
@ApiBearerAuth()
@Controller('projects/:projectId/tasks/:taskId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Post()
  @ApiOperation({ summary: 'Comentar una tarea o subtarea' })
  create(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CommentView> {
    return this.comments.create(projectId, taskId, user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Hilo de comentarios, el más antiguo primero' })
  list(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<CommentView[]> {
    return this.comments.list(projectId, taskId, user.id);
  }

  @Patch(':commentId')
  @ApiOperation({ summary: 'Editar un comentario (solo su autor)' })
  update(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: AuthUser,
  ): Promise<CommentView> {
    return this.comments.update(projectId, taskId, commentId, user.id, dto);
  }

  @Delete(':commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Borrar un comentario (su autor, o el propietario)',
  })
  remove(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    return this.comments.remove(projectId, taskId, commentId, user.id);
  }
}
