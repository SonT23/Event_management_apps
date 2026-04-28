import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { CheckInByQrDto } from './dto/check-in-by-qr.dto';
import { EventCheckinsService } from './event-checkins.service';

@SkipThrottle()
@Controller('events')
@UseGuards(AuthGuard('jwt'))
export class EventCheckinsController {
  constructor(private readonly checkins: EventCheckinsService) {}

  @Get(':eventId/check-ins')
  list(
    @Param('eventId') eventId: string,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.checkins.listForEvent(eventId, u);
  }

  @Post(':eventId/check-in/scan')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  scan(
    @Param('eventId') eventId: string,
    @Body() dto: CheckInByQrDto,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.checkins.scan(eventId, dto, u);
  }
}
