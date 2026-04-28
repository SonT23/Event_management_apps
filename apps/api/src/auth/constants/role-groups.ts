/** Vai trò xét là “lãnh đạo/điều hành CLB” (tạo sự kiện, duyệt nhiều nghiệp vụ) */
export const CLUB_LEADERSHIP_ROLES = [
  'PRESIDENT',
  'VICE_PRES_OP',
  'VICE_PRES_PRO',
  'DEPT_HEAD',
  'CENTER_HEAD',
  'SECRETARY',
  'EXEC_BOARD',
] as const;

export type ClubLeadershipCode = (typeof CLUB_LEADERSHIP_ROLES)[number];
