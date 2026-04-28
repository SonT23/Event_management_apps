import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { EventMeetingsController } from './event-meetings.controller';
import { EventMeetingsService } from './event-meetings.service';

@Module({
  imports: [EventsModule],
  controllers: [EventMeetingsController],
  providers: [EventMeetingsService],
})
export class MeetingsModule {}
