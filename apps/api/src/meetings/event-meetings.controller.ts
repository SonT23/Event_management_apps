import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import {
  CreateEventMeetingDto,
  UpdateEventMeetingDto,
} from './dto/create-event-meeting.dto';
import { CheckInByQrDto } from '../events/dto/check-in-by-qr.dto';
import { RecordMeetingAttendanceDto } from './dto/record-meeting-attendance.dto';
import { EventMeetingsService } from './event-meetings.service';

@SkipThrottle()
@Controller('events')
@UseGuards(AuthGuard('jwt'))
export class EventMeetingsController {
  constructor(private readonly meetings: EventMeetingsService) {}

  @Get(':eventId/meetings')
  list(
    @Param('eventId') eventId: string,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.meetings.listForEvent(eventId, u);
  }

  @Post(':eventId/meetings')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateEventMeetingDto,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.meetings.create(eventId, dto, u);
  }

  @Post(':eventId/meetings/:meetingId/cancel')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  cancel(
    @Param('eventId') eventId: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.meetings.cancel(eventId, meetingId, u);
  }

  @Post(':eventId/meetings/:meetingId/end-early')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  endEarly(
    @Param('eventId') eventId: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.meetings.endEarly(eventId, meetingId, u);
  }

  @Get(':eventId/meetings/:meetingId')
  getOne(
    @Param('eventId') eventId: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.meetings.getOne(eventId, meetingId, u);
  }

  @Patch(':eventId/meetings/:meetingId')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  update(
    @Param('eventId') eventId: string,
    @Param('meetingId') meetingId: string,
    @Body() dto: UpdateEventMeetingDto,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.meetings.update(eventId, meetingId, dto, u);
  }

  @Delete(':eventId/meetings/:meetingId')
  remove(
    @Param('eventId') eventId: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.meetings.remove(eventId, meetingId, u);
  }

  @Get(':eventId/meetings/:meetingId/attendance')
  listAttendance(
    @Param('eventId') eventId: string,
    @Param('meetingId') meetingId: string,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.meetings.listAttendance(eventId, meetingId, u);
  }

  @Post(':eventId/meetings/:meetingId/attendance/scan')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  recordAttendanceByQr(
    @Param('eventId') eventId: string,
    @Param('meetingId') meetingId: string,
    @Body() dto: CheckInByQrDto,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.meetings.recordAttendanceByQr(eventId, meetingId, dto, u);
  }

  @Post(':eventId/meetings/:meetingId/attendance')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  recordAttendance(
    @Param('eventId') eventId: string,
    @Param('meetingId') meetingId: string,
    @Body() dto: RecordMeetingAttendanceDto,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.meetings.recordAttendance(eventId, meetingId, dto, u);
  }
}
