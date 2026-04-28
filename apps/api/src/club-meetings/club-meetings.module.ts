import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ClubMeetingsController } from './club-meetings.controller';
import { ClubMeetingsService } from './club-meetings.service';

@Module({
  imports: [PrismaModule],
  controllers: [ClubMeetingsController],
  providers: [ClubMeetingsService],
  exports: [ClubMeetingsService],
})
export class ClubMeetingsModule {}
