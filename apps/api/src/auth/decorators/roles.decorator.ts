import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'clubRoles';

/** Yêu cầu user có ít nhất một mã trong `roles` table (vd: PRESIDENT, MEMBER). */
export const Roles = (...codes: string[]) => SetMetadata(ROLES_KEY, codes);
