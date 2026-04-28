import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { toBigId } from '../common/utils/id';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { UserNotificationsService } from './user-notifications.service';

@SkipThrottle()
@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private readonly notifications: UserNotificationsService) {}

  @Post(':id/read')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  async markRead(
    @CurrentUser() user: RequestUserPayload,
    @Param('id') id: string,
  ) {
    const bid = toBigId(id, 'notificationId');
    return this.notifications.markRead(user.id, bid);
  }

  @Post('read-all')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async markAllRead(@CurrentUser() user: RequestUserPayload) {
    return this.notifications.markAllRead(user.id);
  }
}
