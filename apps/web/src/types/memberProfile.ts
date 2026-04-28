export type MemberEngagementProfile = {
  generatedAt: string
  profile: {
    userId: string
    fullName: string
    studentId?: string | null
    email: string | null
    gender: string
    birthDate: string | null
    major: string | null
    phone: string | null
    positionTitle: string | null
    primaryDepartment: { id: number; code: string; name: string } | null
    membershipStatus: string
    joinedAt: string
    lastLoginAt: string | null
    isActive: boolean | undefined
  }
  quarter: {
    year: number
    quarter: 1 | 2 | 3 | 4
    label: string
    score: number
    meetingOnTime: number
    meetingLate: number
    meetingOutOfWindow: number
    meetingAbsent: number
    eventCheckins: number
    absenceApproved: number
    participationCancelApproved: number
    eventsParticipated: number
    eventsPerfectParticipation: number
  }
  sinceJoin: {
    label: string
    score: number
    meetingOnTime: number
    meetingLate: number
    meetingOutOfWindow: number
    meetingAbsent: number
    eventCheckins: number
    absenceApproved: number
    participationCancelApproved: number
    eventsParticipated: number
    eventsPerfectParticipation: number
  }
  participationPie: { key: string; name: string; value: number }[]
  conductPie: { key: string; name: string; value: number }[]
  events: {
    upcoming: {
      eventId: string
      title: string
      startAt: string
      status: string
      hasCheckin: boolean
    }[]
    past: {
      eventId: string
      title: string
      startAt: string
      status: string
      hasCheckin: boolean
    }[]
  }
}
