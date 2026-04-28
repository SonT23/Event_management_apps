import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { CreateWarningDto } from './dto/create-warning.dto';
import { WarningsService } from './warnings.service';

@SkipThrottle()
@Controller('warnings')
@UseGuards(AuthGuard('jwt'))
export class WarningsController {
  constructor(private readonly warnings: WarningsService) {}

  @Get()
  inbox(@CurrentUser() u: RequestUserPayload) {
    return this.warnings.listInbox(u);
  }

  @Get('sent')
  sent(@CurrentUser() u: RequestUserPayload) {
    return this.warnings.listSent(u);
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  create(@Body() dto: CreateWarningDto, @CurrentUser() u: RequestUserPayload) {
    return this.warnings.create(dto, u);
  }

  @Post(':id/ack')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  ack(@Param('id') id: string, @CurrentUser() u: RequestUserPayload) {
    return this.warnings.acknowledge(id, u);
  }
}
