import { Module } from '@nestjs/common';
import { MembersModule } from '../members/members.module.js';
import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';

@Module({
  imports: [MembersModule],
  controllers: [MetricsController],
  providers: [MetricsService],
})
export class MetricsModule {}
