import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { AUTH_ACCESS_COOKIE } from '../auth.constants';
import { RequestUserPayload } from '../types/request-user-payload';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly auth: AuthService,
  ) {
    const fromCookie = (req: Request) => {
      const name =
        config.get<string>('AUTH_ACCESS_COOKIE') ?? AUTH_ACCESS_COOKIE;
      const c = (req as Request & { cookies?: Record<string, string> }).cookies;
      if (c?.[name]) {
        return c[name];
      }
      return null;
    };
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        fromCookie,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
  }): Promise<RequestUserPayload> {
    const user = await this.auth.findUserByIdForAuth(BigInt(payload.sub));
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
