import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { ClubMeetingsService } from './club-meetings.service';
import {
  CreateClubMeetingDto,
  DecideClubMeetingAbsenceDto,
  RequestClubMeetingAbsenceDto,
} from './dto/club-meeting.dto';

@SkipThrottle()
@Controller('club-meetings')
@UseGuards(AuthGuard('jwt'))
export class ClubMeetingsController {
  constructor(private readonly service: ClubMeetingsService) {}

  @Get()
  list(@CurrentUser() u: RequestUserPayload) {
    return this.service.list(u);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  create(
    @Body() dto: CreateClubMeetingDto,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.service.create(dto, u);
  }

  @Post(':id/cancel')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  cancel(@Param('id') id: string, @CurrentUser() u: RequestUserPayload) {
    return this.service.cancel(id, u);
  }

  @Post(':id/absence')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  requestAbsence(
    @Param('id') id: string,
    @Body() dto: RequestClubMeetingAbsenceDto,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.service.requestAbsence(id, dto, u);
  }

  @Get(':id/absence')
  listAbsence(
    @Param('id') id: string,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.service.listAbsenceRequests(id, u);
  }

  @Patch(':id/absence/:requestId')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  decideAbsence(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body() dto: DecideClubMeetingAbsenceDto,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.service.decideAbsence(id, requestId, dto, u);
  }
}
