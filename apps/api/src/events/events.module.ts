import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventRegistrationsService } from './event-registrations.service';
import { EventPolicyService } from './event-policy.service';
import { EventCheckinsController } from './event-checkins.controller';
import { EventCheckinsService } from './event-checkins.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { RegistrationsPortalController } from './registrations-portal.controller';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [
    EventsController,
    RegistrationsPortalController,
    EventCheckinsController,
  ],
  providers: [
    EventPolicyService,
    EventsService,
    EventRegistrationsService,
    EventCheckinsService,
  ],
  exports: [
    EventPolicyService,
    EventsService,
    EventRegistrationsService,
    EventCheckinsService,
  ],
})
export class EventsModule {}
