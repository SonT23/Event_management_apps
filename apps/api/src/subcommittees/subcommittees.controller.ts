import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { AddSubcommitteeMemberDto } from './dto/add-subcommittee-member.dto';
import {
  CreateSubcommitteeDto,
  UpdateSubcommitteeDto,
} from './dto/create-subcommittee.dto';
import { SubcommitteesService } from './subcommittees.service';

@SkipThrottle()
@Controller('events')
@UseGuards(AuthGuard('jwt'))
export class SubcommitteesController {
  constructor(private readonly subcommittees: SubcommitteesService) {}

  @Get(':eventId/subcommittees')
  list(
    @Param('eventId') eventId: string,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.subcommittees.listForEvent(eventId, u);
  }

  @Post(':eventId/subcommittees')
  create(
    @Param('eventId') eventId: string,
    @Body() dto: CreateSubcommitteeDto,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.subcommittees.create(eventId, dto, u);
  }

  @Get(':eventId/subcommittees/:subId')
  getOne(
    @Param('eventId') eventId: string,
    @Param('subId') subId: string,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.subcommittees.getOne(eventId, subId, u);
  }

  @Patch(':eventId/subcommittees/:subId')
  update(
    @Param('eventId') eventId: string,
    @Param('subId') subId: string,
    @Body() dto: UpdateSubcommitteeDto,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.subcommittees.update(eventId, subId, dto, u);
  }

  @Delete(':eventId/subcommittees/:subId')
  remove(
    @Param('eventId') eventId: string,
    @Param('subId') subId: string,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.subcommittees.remove(eventId, subId, u);
  }

  @Post(':eventId/subcommittees/:subId/members')
  addMember(
    @Param('eventId') eventId: string,
    @Param('subId') subId: string,
    @Body() dto: AddSubcommitteeMemberDto,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.subcommittees.addMember(eventId, subId, dto, u);
  }

  @Delete(':eventId/subcommittees/:subId/members/:userId')
  removeMember(
    @Param('eventId') eventId: string,
    @Param('subId') subId: string,
    @Param('userId') userId: string,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.subcommittees.removeMember(eventId, subId, userId, u);
  }
}
