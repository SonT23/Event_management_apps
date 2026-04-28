import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { AnalyticsService } from './analytics.service';

@SkipThrottle()
@Controller('analytics')
@UseGuards(AuthGuard('jwt'))
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * Xếp hạng & thống kê tham gia (họp + sự kiện) — BCH / trưởng ban.
   * @param eventId Tùy chọn: chỉ một sự kiện (bỏ qua lọc quý).
   * @param period `quarter` — lọc sự kiện theo `events.start_at` trong quý; `all` — mọi thời gian.
   * @param year Kèm `quarter` (mặc định năm hiện tại).
   * @param quarter 1–4 (mặc định quý hiện tại).
   */
  @Get('member-discipline')
  memberDiscipline(
    @CurrentUser() user: RequestUserPayload,
    @Query('eventId') eventId?: string,
    @Query('period') periodRaw?: string,
    @Query('year') yearRaw?: string,
    @Query('quarter') quarterRaw?: string,
  ) {
    const period = periodRaw === 'quarter' ? 'quarter' : 'all';
    const year =
      yearRaw != null && yearRaw !== ''
        ? Number.parseInt(yearRaw, 10)
        : undefined;
    const quarter =
      quarterRaw != null && quarterRaw !== ''
        ? Number.parseInt(quarterRaw, 10)
        : undefined;
    return this.analytics.memberDiscipline(user, {
      eventIdParam: eventId,
      period,
      year: Number.isFinite(year) ? year : undefined,
      quarter: Number.isFinite(quarter) ? quarter : undefined,
    });
  }

  /** Hồ sơ tham gia & thống kê một hội viên (BCH hoặc chính họ). */
  @Get('member-profile/:userId')
  memberProfile(
    @CurrentUser() user: RequestUserPayload,
    @Param('userId') userId: string,
  ) {
    return this.analytics.memberEngagementProfile(user, userId);
  }
}
