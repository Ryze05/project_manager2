import { Module } from '@nestjs/common';
import { MembersModule } from '../members/members.module.js';
import { ActivityController } from './activity.controller.js';
import { ActivityService } from './activity.service.js';

/**
 * Reading only. Writing is the plain function `recordActivity`, so Tasks,
 * Comments and Members can use it without depending on this module (this one
 * depends on Members, and a Members -> Activity import would be a cycle).
 */
@Module({
  imports: [MembersModule],
  controllers: [ActivityController],
  providers: [ActivityService],
})
export class ActivityModule {}
