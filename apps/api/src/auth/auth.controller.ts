import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestUserPayload } from './types/request-user-payload';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(201)
  @Throttle({ auth: { limit: 3, ttl: 60000 } })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const m = AuthService.clientMeta(req);
    return this.auth.register(dto, res, m);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const m = AuthService.clientMeta(req);
    const u = await this.auth.validateUserByCredentials(
      dto.email,
      dto.password,
    );
    const tokens = await this.auth.issueTokenPair(u, res, m);
    return { ...tokens, user: await this.auth.toUserResponseWithNotifications(u) };
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ auth: { limit: 20, ttl: 60000 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.refreshTokens(req, res);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(req, res);
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  async changePassword(
    @CurrentUser() user: RequestUserPayload,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.changePassword(
      user,
      dto.currentPassword,
      dto.newPassword,
      res,
    );
  }

  @Get('me')
  @SkipThrottle({ default: true, auth: true })
  @UseGuards(AuthGuard('jwt'))
  async me(@CurrentUser() user: RequestUserPayload) {
    return this.auth.toUserResponseWithNotifications(user);
  }
}
