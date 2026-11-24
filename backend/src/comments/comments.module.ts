import { Module } from '@nestjs/common';
import { MembersModule } from '../members/members.module.js';
import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';

@Module({
  imports: [MembersModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
