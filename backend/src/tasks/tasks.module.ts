import { Module } from '@nestjs/common';
import { MembersModule } from '../members/members.module.js';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

@Module({
  imports: [MembersModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
