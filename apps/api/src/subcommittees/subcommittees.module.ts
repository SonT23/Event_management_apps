import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { SubcommitteesController } from './subcommittees.controller';
import { SubcommitteesService } from './subcommittees.service';

@Module({
  imports: [EventsModule],
  controllers: [SubcommitteesController],
  providers: [SubcommitteesService],
})
export class SubcommitteesModule {}
