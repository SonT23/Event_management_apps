import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SetMembershipDto } from './dto/set-membership.dto';
import { MembersService } from './members.service';
import { DefaultValuePipe, ParseIntPipe } from '@nestjs/common';

@SkipThrottle()
@Controller('members')
@UseGuards(AuthGuard('jwt'))
export class MembersController {
  constructor(private readonly members: MembersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: RequestUserPayload) {
    if (!user.members) {
      return { member: null, message: 'Chưa có bản hồ sơ members' };
    }
    return this.members.getByUserId(user.id);
  }

  @Patch('me')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async updateMe(
    @CurrentUser() user: RequestUserPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    if (!user.members) {
      // đăng ký đã tạo members — nếu thiếu, không cập nhật được
      return { error: 'No member profile' };
    }
    return this.members.updateOwnProfile(user, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: RequestUserPayload,
    @Query('departmentId') departmentId?: string,
    @Query('includeInactive') includeInactiveRaw?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize = 20,
  ) {
    const y = (includeInactiveRaw ?? '').toLowerCase();
    const includeInactive = y === '1' || y === 'true' || y === 'yes';
    return this.members.listMembers(user, {
      departmentId,
      page,
      pageSize,
      includeInactive,
    });
  }

  @Post()
  async create(
    @CurrentUser() user: RequestUserPayload,
    @Body() dto: CreateMemberDto,
  ) {
    return this.members.createByStaff(user, dto);
  }

  @Patch(':userId/membership')
  async setMembership(
    @CurrentUser() user: RequestUserPayload,
    @Param('userId') userId: string,
    @Body() dto: SetMembershipDto,
  ) {
    return this.members.setMembershipStatus(user, userId, dto);
  }

  @Patch(':userId')
  async updateMember(
    @CurrentUser() user: RequestUserPayload,
    @Param('userId') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.members.updateMemberByStaff(user, userId, dto);
  }

  @Delete(':userId')
  async removeMember(
    @CurrentUser() user: RequestUserPayload,
    @Param('userId') userId: string,
  ) {
    return this.members.hardDeleteUser(user, userId);
  }

  @Get(':userId')
  async getOne(
    @Param('userId') userId: string,
    @CurrentUser() user: RequestUserPayload,
  ) {
    return this.members.getOneForStaff(userId, user);
  }
}
