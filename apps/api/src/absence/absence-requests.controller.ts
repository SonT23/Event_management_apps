import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { AbsenceService } from './absence.service';
import { DecideAbsenceRequestDto } from './dto/decide-absence-request.dto';

@SkipThrottle()
@Controller('absence-requests')
@UseGuards(AuthGuard('jwt'))
export class AbsenceRequestsController {
  constructor(private readonly absence: AbsenceService) {}

  @Patch(':id')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  decide(
    @Param('id') id: string,
    @Body() dto: DecideAbsenceRequestDto,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.absence.decide(id, dto, u);
  }
}
