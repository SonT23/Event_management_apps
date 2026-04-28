import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { UserNotificationsService } from './user-notifications.service';
import { PendingRegistrationCleanupService } from './pending-registration-cleanup.service';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [UserNotificationsService, PendingRegistrationCleanupService],
  exports: [UserNotificationsService],
})
export class NotificationsModule {}
