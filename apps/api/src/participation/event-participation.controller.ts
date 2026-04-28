import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { CreateParticipationCancellationDto } from './dto/create-participation-cancellation.dto';
import { ParticipationCancellationsService } from './participation-cancellations.service';

@SkipThrottle()
@Controller('events')
@UseGuards(AuthGuard('jwt'))
export class EventParticipationController {
  constructor(
    private readonly participation: ParticipationCancellationsService,
  ) {}

  @Get(':eventId/participation-cancellations')
  list(
    @Param('eventId') eventId: string,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.participation.listForEvent(eventId, u);
  }

  @Post(':eventId/participation-cancellations')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateParticipationCancellationDto,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.participation.create(eventId, dto, u);
  }
}
