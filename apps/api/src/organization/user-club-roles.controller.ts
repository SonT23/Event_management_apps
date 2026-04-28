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
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { AddClubRoleDto, PatchClubRoleDto } from './dto/add-club-role.dto';
import { UserClubRolesService } from './user-club-roles.service';

@SkipThrottle()
@Controller('org')
@UseGuards(AuthGuard('jwt'))
export class UserClubRolesController {
  constructor(private readonly clubRoles: UserClubRolesService) {}

  @Get('users/:userId/club-roles')
  list(@Param('userId') userId: string, @CurrentUser() u: RequestUserPayload) {
    return this.clubRoles.listForUser(userId, u);
  }

  @Post('users/:userId/club-roles')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  add(
    @Param('userId') userId: string,
    @Body() dto: AddClubRoleDto,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.clubRoles.add(userId, dto, u);
  }

  @Patch('club-roles/:id')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  patch(
    @Param('id') id: string,
    @Body() dto: PatchClubRoleDto,
    @CurrentUser() u: RequestUserPayload,
  ) {
    return this.clubRoles.patch(id, dto, u);
  }

  @Delete('club-roles/:id')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  remove(@Param('id') id: string, @CurrentUser() u: RequestUserPayload) {
    return this.clubRoles.remove(id, u);
  }
}
