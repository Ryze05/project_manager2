import { Module } from '@nestjs/common';
import { MembersModule } from '../members/members.module.js';
import { LabelsController } from './labels.controller.js';
import { LabelsService } from './labels.service.js';

@Module({
  imports: [MembersModule],
  controllers: [LabelsController],
  providers: [LabelsService],
})
export class LabelsModule {}
