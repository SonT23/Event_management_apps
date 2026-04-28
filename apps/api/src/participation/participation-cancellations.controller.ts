import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { DecideParticipationCancellationDto } from './dto/decide-participation-cancellation.dto';
import { ParticipationCancellationsService } from './participation-cancellations.service';

@SkipThrottle()
@Controller('participation-cancellations')
@UseGuards(AuthGuard('jwt'))
export class ParticipationCancellationsController {
  constructor(
    private readonly participation: ParticipationCancellationsService,
  ) {}

  @Patch(':id')
  @Throttle({ default: { limit: 50, ttl: 60_000 } })
  decide(
    @Param('id') id: string,
    @Body() dto: DecideParticipationCancellationDto,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.participation.decide(id, dto, u);
  }
}
