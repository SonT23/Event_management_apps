export type ClubMeetingListItem = {

  id: string

  source?: 'club' | 'event'

  eventId?: string | null

  eventTitle?: string | null

  eventMeetingType?: 'pre_event' | 'in_event' | null

  title: string

  detail: string | null

  kind: string

  mandatoryScope: string

  startAt: string

  endAt: string

  status: string

  cancelledAt: string | null

  createdBy: string

  creatorEmail?: string

  creatorName: string | null

  createdAt: string

  updatedAt: string

  /** BCH xem toàn bộ mã người mời */

  invitedUserIds?: string[]

  imInInviteeList?: boolean

  inviteeCount?: number

  myAbsenceRequest: {

    id: string

    status: string

    reason: string

    createdAt: string

  } | null

}



export type ClubAbsenceRow = {

  id: string

  userId: string

  fullName: string | null

  email?: string

  reason: string

  status: string

  createdAt: string

  decidedAt: string | null

}

