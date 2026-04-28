import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUserPayload } from '../types/request-user-payload';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUserPayload => {
    const req = ctx.switchToHttp().getRequest<{ user: RequestUserPayload }>();
    return req.user;
  },
);
