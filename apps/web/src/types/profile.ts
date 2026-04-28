export type ClubRoleRow = {
  roleCode: string
  roleName: string
  departmentId: string | null
  departmentCode: string | null
  departmentName: string | null
  isPrimary: boolean
}

export type MemberProfile = {
  userId: string
  fullName: string
  /** MSSV — có thể null */
  studentId?: string | null
  gender: string | null
  birthDate: string | null
  major: string | null
  primaryDepartmentId: string | null
  positionTitle: string | null
  phone: string | null
  membershipStatus: string
  inactiveAt: string | null
  inactiveReason: string | null
}

export type AuthNotification = {
  id: string
  kind: string
  title: string
  body: string
  createdAt: string
}

export type AuthUser = {
  id: string
  email: string
  member: MemberProfile | null
  clubRoles: ClubRoleRow[]
  /** Thông báo chưa đọc (ví dụ đăng ký bị từ chối); GET /auth/me */
  unreadNotifications?: AuthNotification[]
}
