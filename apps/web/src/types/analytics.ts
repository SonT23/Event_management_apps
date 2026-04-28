export type MemberDisciplineRow = {
  rank: number
  userId: string
  fullName: string
  email: string
  score: number
  meetingOnTime: number
  meetingLate: number
  meetingOutOfWindow: number
  meetingAbsent: number
  eventCheckins: number
  absenceApproved: number
  participationCancelApproved: number
  /** Số sự kiện (phạm vi lọc) có check-in tham gia, sau khi đăng ký được duyệt */
  eventsParticipated: number
  /** Sự kiện có check-in và điểm danh đúng giờ đủ mọi buổi họp đã lên lịch */
  eventsPerfectParticipation: number
}

export type MemberDisciplineResponse = {
  generatedAt: string
  scope: {
    eventId: string | null
    period: 'all' | 'quarter'
    year: number | null
    quarter: 1 | 2 | 3 | 4 | null
    dateFrom: string | null
    dateToExclusive: string | null
    description: string
  }
  ranking: MemberDisciplineRow[]
}
