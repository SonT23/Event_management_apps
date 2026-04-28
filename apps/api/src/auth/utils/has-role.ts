import { CLUB_LEADERSHIP_ROLES } from '../constants/role-groups';

const leadershipSet = new Set<string>(CLUB_LEADERSHIP_ROLES);

export function isClubLeadership(roleCodes: string[]) {
  return roleCodes.some((c) => leadershipSet.has(c));
}

const deptHeadSet = new Set<string>(['DEPT_HEAD', 'CENTER_HEAD']);

export function isDeptOrCenterHead(roleCodes: string[]) {
  return roleCodes.some((c) => deptHeadSet.has(c));
}
