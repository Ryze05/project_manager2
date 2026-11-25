import { Module } from '@nestjs/common';
import { MembersModule } from '../members/members.module.js';
import { UsersModule } from '../users/users.module.js';
import {
  MyInvitationsController,
  ProjectInvitationsController,
} from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';

@Module({
  imports: [MembersModule, UsersModule],
  controllers: [ProjectInvitationsController, MyInvitationsController],
  providers: [InvitationsService],
})
export class InvitationsModule {}
