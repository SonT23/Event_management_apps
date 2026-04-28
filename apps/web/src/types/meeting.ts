export type EventMeetingItem = {

  id: string

  eventId: string

  title: string

  reason: string | null

  status: 'scheduled' | 'cancelled'

  cancelledAt: string | null

  meetingType: 'pre_event' | 'in_event'

  startAt: string

  /** Dự kiến kết thúc */

  endAt: string

  /** Khi quản lý bấm kết thúc sớm */

  actualEndAt?: string | null

  /** Thời điểm kết thúc chính thức (sớm nếu có, không thì = dự kiến) */

  officialEndAt?: string

  scanOpenAt: string | null

  scanCloseAt: string | null

  createdBy: string

  creatorEmail?: string

  createdAt: string

}

