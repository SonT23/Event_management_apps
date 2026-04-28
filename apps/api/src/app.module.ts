import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { OrganizationModule } from './organization/organization.module';
import { AuthModule } from './auth/auth.module';
import { MembersModule } from './members/members.module';
import { EventsModule } from './events/events.module';
import { SubcommitteesModule } from './subcommittees/subcommittees.module';
import { MeetingsModule } from './meetings/meetings.module';
import { WarningsModule } from './warnings/warnings.module';
import { PenaltiesModule } from './penalties/penalties.module';
import { AbsenceModule } from './absence/absence.module';
import { ParticipationModule } from './participation/participation.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ClubMeetingsModule } from './club-meetings/club-meetings.module';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    NotificationsModule,
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 60_000, limit: 300 },
        // Mặc định cao: @SkipThrottle() chỉ bỏ tên `default`, không bỏ `auth` — mọi route
        // còn dùng hạn mức tại đây. Giới hạn thật ở @Throttle trên từng route (vd. login).
        { name: 'auth', ttl: 60_000, limit: 5_000 },
      ],
    }),
    PrismaModule,
    HealthModule,
    OrganizationModule,
    AuthModule,
    MembersModule,
    EventsModule,
    SubcommitteesModule,
    MeetingsModule,
    WarningsModule,
    PenaltiesModule,
    AbsenceModule,
    ParticipationModule,
    AnalyticsModule,
    ClubMeetingsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
