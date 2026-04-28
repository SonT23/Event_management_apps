import type {
  members,
  roles,
  user_club_roles,
  departments,
} from '@prisma/client';

type ClubRoleRow = user_club_roles & {
  roles: roles;
  departments: departments | null;
};

/** User gắn trên `req` sau khi qua `Jwt` / `Local` (chưa chuẩn hóa JSON) */
export type RequestUserPayload = {
  id: bigint;
  email: string;
  is_active: boolean;
  members: members | null;
  user_club_roles: ClubRoleRow[];
  roleCodes: string[];
};
