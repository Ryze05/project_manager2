import { Module } from '@nestjs/common';
import { MyTasksController } from './my-tasks.controller.js';
import { MyTasksService } from './my-tasks.service.js';

@Module({
  controllers: [MyTasksController],
  providers: [MyTasksService],
})
export class MyTasksModule {}
