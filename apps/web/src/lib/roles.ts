import type { AuthUser } from '@/types/profile'

/** Khớp `CLUB_LEADERSHIP_ROLES` phía API */
export const CLUB_LEADERSHIP_ROLE_CODES = [
  'PRESIDENT',
  'VICE_PRES_OP',
  'VICE_PRES_PRO',
  'DEPT_HEAD',
  'CENTER_HEAD',
  'SECRETARY',
  'EXEC_BOARD',
] as const

const DEPT_OR_CENTER_HEAD_CODES = ['DEPT_HEAD', 'CENTER_HEAD'] as const

export function isClubLeadership(roleCodes: string[]) {
  const set = new Set(CLUB_LEADERSHIP_ROLE_CODES)
  return roleCodes.some((c) => set.has(c as (typeof CLUB_LEADERSHIP_ROLE_CODES)[number]))
}

/** Phạm vi "Trưởng ban" (không bao hết roles BCH như hội trưởng, thư ký, …) */
export function isDeptOrCenterHead(roleCodes: string[]) {
  return roleCodes.some((c) =>
    (DEPT_OR_CENTER_HEAD_CODES as readonly string[]).includes(c),
  )
}

export function roleCodesFromUser(u: AuthUser) {
  return u.clubRoles.map((r) => r.roleCode)
}
