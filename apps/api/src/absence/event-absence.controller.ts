import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { AbsenceService } from './absence.service';
import { CreateAbsenceRequestDto } from './dto/create-absence-request.dto';

@SkipThrottle()
@Controller('events')
@UseGuards(AuthGuard('jwt'))
export class EventAbsenceController {
  constructor(private readonly absence: AbsenceService) {}

  @Get(':eventId/absence-requests')
  list(
    @Param('eventId') eventId: string,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.absence.listForEvent(eventId, u);
  }

  @Post(':eventId/absence-requests')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateAbsenceRequestDto,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.absence.create(eventId, dto, u);
  }
}
