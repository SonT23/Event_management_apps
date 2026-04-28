export type EventManagerRef = {
  userId: string
  fullName: string | null
  email: string | null
}

export type EventListItem = {
  id: string
  title: string
  description: string | null
  startAt: string
  expectedEndAt: string | null
  actualEndAt: string | null
  status: string
  requiresApproval: boolean
  defaultCancelMinutes: number | null
  createdBy: string
  creatorEmail?: string
  /** Quản lý sự kiện (bảng event_managers) */
  managers?: EventManagerRef[]
  createdAt: string
  updatedAt: string
}

export type EventListResponse = {
  page: number
  pageSize: number
  total: number
  items: EventListItem[]
}

/** GET /events/managed — sự kiện user được phân công quản lý */
export type ManagedEventsResponse = {
  items: EventListItem[]
}

export type RegistrationListRow = {
  id: string
  userId: string
  email?: string
  fullName?: string | null
  status: string
  createdAt: string
  checkedInAt: string | null
  cancelNotBefore: string | null
}

export type SubcommitteeRow = {
  id: string
  eventId: string
  name: string
  code: string | null
  maxMembers: number | null
  memberCount: number
  createdBy: string
  createdAt: string
  members: {
    id: string
    userId: string
    fullName: string | null
    email?: string
    assignedAt: string
  }[]
}

export type CheckinListRow = {
  id: string
  registrationId: string
  userId: string
  fullName: string | null
  email?: string
  scannedAt: string
  scannedBy: string
  scannerName: string | null
  note: string | null
}

export type MyRegistration = {
  id: string
  eventId: string
  eventTitle: string
  status: string
  createdAt: string
  hasQr: boolean
  checkedInAt: string | null
  cancelNotBefore: string | null
  startAt: string
}

export type OrgSummary = {
  period: {
    year: number
    quarter: number
    label: string
    from: string
    to: string
  }
  membersTotal: number
  membersActive: number
  eventsTotal: number
  registrationsApproved: number
  checkinsTotal: number
  registrationsPending: number
  eventsUpcoming: number
  participationCancellationsPending: number
  /** Ảnh chụp phân bổ hội viên (toàn thời điểm) */
  membersByStatus: { status: string; count: number }[]
  /** Sự kiện có start_at trong kỳ */
  eventsByStatus: { status: string; count: number }[]
  /** Đăng ký có created_at trong kỳ */
  registrationsByStatus: { status: string; count: number }[]
  /** Ba tháng trong quý được chọn */
  monthlyEventStartsInQuarter: { month: string; count: number }[]
  generatedAt: string
}

/** GET /org/summary/all-time — thống kê tích lũy (BCH) */
export type OrgSummaryAllTime = {
  scope: 'all_time'
  period: {
    label: string
    from: string | null
    to: string
  }
  membersTotal: number
  membersActive: number
  membersByStatus: { status: string; count: number }[]
  usersActive: number
  eventsTotal: number
  eventsByStatus: { status: string; count: number }[]
  eventMeetingsTotal: number
  clubMeetingsTotal: number
  registrationsApproved: number
  registrationsPending: number
  registrationsRejected: number
  registrationsCancelled: number
  checkinsTotal: number
  eventsUpcoming: number
  participationCancellationsPending: number
  absenceRequestsPending: number
  monthlyEventStarts: { month: string; count: number }[]
  generatedAt: string
}

/** GET /org/summary/drilldown?section=... (BCH) */
export type OrgDrilldownTable = {
  columns: { key: string; label: string }[]
  rows: Record<string, string>[]
}

export type OrgDrilldownResponse = {
  section: string
  title: string
  table?: OrgDrilldownTable
  chart?: {
    kind: 'bar'
    label: string
    points: { label: string; value: number }[]
  }
}
