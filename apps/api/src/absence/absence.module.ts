import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { AbsenceRequestsController } from './absence-requests.controller';
import { AbsenceService } from './absence.service';
import { EventAbsenceController } from './event-absence.controller';

@Module({
  imports: [EventsModule],
  controllers: [EventAbsenceController, AbsenceRequestsController],
  providers: [AbsenceService],
})
export class AbsenceModule {}
