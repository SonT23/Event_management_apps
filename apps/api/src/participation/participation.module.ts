import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { EventParticipationController } from './event-participation.controller';
import { ParticipationCancellationsController } from './participation-cancellations.controller';
import { ParticipationCancellationsService } from './participation-cancellations.service';

@Module({
  imports: [EventsModule],
  controllers: [
    EventParticipationController,
    ParticipationCancellationsController,
  ],
  providers: [ParticipationCancellationsService],
})
export class ParticipationModule {}
