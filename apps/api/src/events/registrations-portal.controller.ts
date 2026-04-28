import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { EventRegistrationsService } from './event-registrations.service';

/** Đăng ký: danh sách của tôi, chi tiết, duyệt theo mã. */
@SkipThrottle()
@Controller('registrations')
@UseGuards(AuthGuard('jwt'))
export class RegistrationsPortalController {
  constructor(private readonly registrations: EventRegistrationsService) {}

  @Get('me')
  async myList(@CurrentUser() user: RequestUserPayload) {
    return this.registrations.myRegistrations(user);
  }

  @Post(':id/withdraw')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async withdraw(
    @Param('id') id: string,
    @CurrentUser() user: RequestUserPayload,
  ) {
    return this.registrations.withdrawSelf(id, user);
  }

  @Post(':id/rotate-qr')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async rotateQr(
    @Param('id') id: string,
    @CurrentUser() user: RequestUserPayload,
  ) {
    return this.registrations.rotateQrToken(id, user);
  }

  @Get(':id')
  async detail(
    @Param('id') id: string,
    @CurrentUser() user: RequestUserPayload,
  ) {
    return this.registrations.getRegistrationDetail(id, user);
  }

  @Post(':id/approve')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: RequestUserPayload,
  ) {
    return this.registrations.approve(id, user);
  }

  @Post(':id/reject')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: RequestUserPayload,
  ) {
    return this.registrations.reject(id, user);
  }
}
