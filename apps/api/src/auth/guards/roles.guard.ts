import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestUserPayload } from '../types/request-user-payload';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) {
      return true;
    }
    const req = ctx.switchToHttp().getRequest<{ user?: RequestUserPayload }>();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException();
    }
    const ok = required.some((code) => user.roleCodes.includes(code));
    if (!ok) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
