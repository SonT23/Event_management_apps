import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { CreatePenaltyDto } from './dto/create-penalty.dto';
import { PenaltiesService } from './penalties.service';

@SkipThrottle()
@Controller('penalties')
@UseGuards(AuthGuard('jwt'))
export class PenaltiesController {
  constructor(private readonly penalties: PenaltiesService) {}

  @Get('rules')
  listRules() {
    return this.penalties.listRules();
  }

  @Get()
  list(@CurrentUser() u: RequestUserPayload, @Query('userId') userId?: string) {
    return this.penalties.listForUser(u, userId);
  }

  @Post()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  create(@Body() dto: CreatePenaltyDto, @CurrentUser() u: RequestUserPayload) {
    return this.penalties.create(dto, u);
  }
}
