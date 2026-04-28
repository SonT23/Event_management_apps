import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { OrganizationService } from './organization.service';

@SkipThrottle()
@Controller('org')
@UseGuards(AuthGuard('jwt'))
export class OrganizationSummaryController {
  constructor(private readonly org: OrganizationService) {}

  @Get('summary/all-time')
  summaryAllTime(@CurrentUser() u: RequestUserPayload) {
    return this.org.leadershipSummaryAllTime(u);
  }

  @Get('summary')
  summary(
    @CurrentUser() u: RequestUserPayload,
    @Query('year') year?: string,
    @Query('quarter') quarter?: string,
  ) {
    return this.org.leadershipSummary(u, year, quarter);
  }

  @Get('summary/drilldown')
  drilldown(
    @CurrentUser() u: RequestUserPayload,
    @Query('section') section?: string,
  ) {
    return this.org.leadershipDrilldown(u, section ?? '');
  }
}
