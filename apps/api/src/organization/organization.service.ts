import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  Prisma,
  event_registrations_status,
  members_membership_status,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** DB cũ chưa có bảng `club_meetings` → P2021 — tránh vỡ trang báo cáo. */
async function clubMeetingsCountOrZero(prisma: PrismaService): Promise<number> {
  try {
    return await prisma.club_meetings.count();
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === 'P2021'
    ) {
      return 0;
    }
    throw e;
  }
}
import { isClubLeadership } from '../auth/utils/has-role';
import { RequestUserPayload } from '../auth/types/request-user-payload';

function resolveQuarterRange(
  yearParam?: string,
  quarterParam?: string,
): { year: number; quarter: number; from: Date; to: Date; label: string } {
  const now = new Date();
  let year = now.getFullYear();
  let quarter = Math.floor(now.getMonth() / 3) + 1;
  if (yearParam && /^\d{4}$/.test(yearParam)) {
    year = parseInt(yearParam, 10);
  }
  if (quarterParam && /^[1-4]$/.test(quarterParam)) {
    quarter = parseInt(quarterParam, 10) as 1 | 2 | 3 | 4;
  }
  const monthStart = (quarter - 1) * 3;
  const from = new Date(year, monthStart, 1, 0, 0, 0, 0);
  const to = new Date(year, monthStart + 3, 0, 23, 59, 59, 999);
  return {
    year,
    quarter,
    from,
    to,
    label: `Q${quarter}/${year}`,
  };
}

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async leadershipSummary(
    u: RequestUserPayload,
    yearParam?: string,
    quarterParam?: string,
  ) {
    if (!isClubLeadership(u.roleCodes)) {
      throw new ForbiddenException();
    }
    const { from, to, year, quarter, label } = resolveQuarterRange(
      yearParam,
      quarterParam,
    );
    const now = new Date();
    const periodWhere = { gte: from, lte: to };
    const [
      membersTotal,
      membersActive,
      eventsTotal,
      registrationsApproved,
      checkinsTotal,
      registrationsPending,
      eventsUpcoming,
      participationCancellationsPending,
      membersByStatus,
      eventsByStatus,
      registrationsByStatus,
    ] = await Promise.all([
      this.prisma.members.count(),
      this.prisma.members.count({
        where: { membership_status: members_membership_status.active },
      }),
      this.prisma.events.count({
        where: { start_at: periodWhere },
      }),
      this.prisma.event_registrations.count({
        where: {
          status: 'approved',
          created_at: periodWhere,
        },
      }),
      this.prisma.event_checkins.count({
        where: { scanned_at: periodWhere },
      }),
      this.prisma.event_registrations.count({
        where: {
          status: 'pending',
          created_at: periodWhere,
        },
      }),
      this.prisma.events.count({
        where: {
          start_at: { gte: now, lte: to },
          status: { in: ['published', 'ongoing'] },
        },
      }),
      this.prisma.participation_cancellations.count({
        where: { status: 'pending' },
      }),
      this.prisma.members.groupBy({
        by: ['membership_status'],
        _count: { _all: true },
      }),
      this.prisma.events.groupBy({
        by: ['status'],
        where: { start_at: periodWhere },
        _count: { _all: true },
      }),
      this.prisma.event_registrations.groupBy({
        by: ['status'],
        where: { created_at: periodWhere },
        _count: { _all: true },
      }),
    ]);

    const monthlyEventStartsInQuarter = await Promise.all(
      [0, 1, 2].map(async (m) => {
        const monthIndex = (quarter - 1) * 3 + m;
        const ms = new Date(year, monthIndex, 1, 0, 0, 0, 0);
        const me = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
        const count = await this.prisma.events.count({
          where: { start_at: { gte: ms, lte: me } },
        });
        return {
          month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
          count,
        };
      }),
    );
    return {
      period: {
        year,
        quarter,
        label,
        from: from.toISOString(),
        to: to.toISOString(),
      },
      membersTotal,
      membersActive,
      eventsTotal,
      registrationsApproved,
      checkinsTotal,
      registrationsPending,
      eventsUpcoming,
      participationCancellationsPending,
      membersByStatus: membersByStatus.map((x) => ({
        status: x.membership_status,
        count: x._count._all,
      })),
      eventsByStatus: eventsByStatus.map((x) => ({
        status: x.status,
        count: x._count._all,
      })),
      registrationsByStatus: registrationsByStatus.map((x) => ({
        status: x.status,
        count: x._count._all,
      })),
      monthlyEventStartsInQuarter,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Thống kê tích lũy từ đầu đến nay (BCH).
   */
  async leadershipSummaryAllTime(u: RequestUserPayload) {
    if (!isClubLeadership(u.roleCodes)) {
      throw new ForbiddenException();
    }
    const now = new Date();
    const [
      membersTotal,
      membersActive,
      membersByStatus,
      usersActive,
      eventsTotal,
      eventsByStatus,
      registrationsByStatus,
      eventMeetingsTotal,
      clubMeetingsTotal,
      checkinsTotal,
      eventsUpcoming,
      participationCancellationsPending,
      absenceRequestsPending,
      firstMember,
      firstEvent,
      eventsForMonthly,
    ] = await Promise.all([
      this.prisma.members.count(),
      this.prisma.members.count({
        where: { membership_status: members_membership_status.active },
      }),
      this.prisma.members.groupBy({
        by: ['membership_status'],
        _count: { _all: true },
      }),
      this.prisma.users.count({ where: { is_active: true } }),
      this.prisma.events.count(),
      this.prisma.events.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.event_registrations.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.event_meetings.count(),
      clubMeetingsCountOrZero(this.prisma),
      this.prisma.event_checkins.count(),
      this.prisma.events.count({
        where: {
          start_at: { gte: now },
          status: { in: ['published', 'ongoing'] },
        },
      }),
      this.prisma.participation_cancellations.count({
        where: { status: 'pending' },
      }),
      this.prisma.absence_requests.count({
        where: { status: 'pending' },
      }),
      this.prisma.members.findFirst({
        orderBy: { created_at: 'asc' },
        select: { created_at: true },
      }),
      this.prisma.events.findFirst({
        orderBy: { start_at: 'asc' },
        select: { start_at: true },
      }),
      this.prisma.events.findMany({
        where: {
          start_at: {
            gte: (() => {
              const d = new Date(now);
              d.setMonth(d.getMonth() - 23);
              d.setDate(1);
              d.setHours(0, 0, 0, 0);
              return d;
            })(),
          },
        },
        select: { start_at: true },
      }),
    ]);

    const regMap = new Map<event_registrations_status, number>();
    for (const r of registrationsByStatus) {
      regMap.set(r.status, r._count._all);
    }
    const registrationsApproved =
      regMap.get(event_registrations_status.approved) ?? 0;
    const registrationsPending =
      regMap.get(event_registrations_status.pending) ?? 0;
    const registrationsRejected =
      regMap.get(event_registrations_status.rejected) ?? 0;
    const registrationsCancelled =
      regMap.get(event_registrations_status.cancelled) ?? 0;

    const monthBucket = new Map<string, number>();
    for (const e of eventsForMonthly) {
      const d = e.start_at;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthBucket.set(key, (monthBucket.get(key) ?? 0) + 1);
    }
    const monthlyEventStarts: { month: string; count: number }[] = [];
    for (let i = 23; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyEventStarts.push({ month: key, count: monthBucket.get(key) ?? 0 });
    }

    let earliest: Date | undefined;
    if (firstMember?.created_at) {
      earliest = firstMember.created_at;
    }
    if (firstEvent?.start_at && (!earliest || firstEvent.start_at < earliest)) {
      earliest = firstEvent.start_at;
    }

    return {
      scope: 'all_time' as const,
      period: {
        label: 'Từ đầu đến nay',
        from: earliest?.toISOString() ?? null,
        to: now.toISOString(),
      },
      membersTotal,
      membersActive,
      membersByStatus: membersByStatus.map((m) => ({
        status: m.membership_status,
        count: m._count._all,
      })),
      usersActive,
      eventsTotal,
      eventsByStatus: eventsByStatus.map((e) => ({
        status: e.status,
        count: e._count._all,
      })),
      eventMeetingsTotal,
      clubMeetingsTotal,
      registrationsApproved,
      registrationsPending,
      registrationsRejected,
      registrationsCancelled,
      checkinsTotal,
      eventsUpcoming,
      participationCancellationsPending,
      absenceRequestsPending,
      monthlyEventStarts,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Chi tiết cho dashboard BCH: bảng + biểu đồ tùy loại.
   */
  async leadershipDrilldown(u: RequestUserPayload, section: string) {
    if (!isClubLeadership(u.roleCodes)) {
      throw new ForbiddenException();
    }
    const s = section.trim().toLowerCase();
    if (!s) {
      throw new BadRequestException('Thiếu query section');
    }
    const col = (key: string, label: string) => ({ key, label });
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    switch (s) {
      case 'users': {
        const rows = await this.prisma.users.findMany({
          where: { is_active: true },
          orderBy: { id: 'asc' },
          take: 500,
          select: { id: true, email: true, created_at: true },
        });
        return {
          section: s,
          title: 'Tài khoản hoạt động',
          table: {
            columns: [col('id', 'ID'), col('email', 'Email'), col('createdAt', 'Tạo lúc')],
            rows: rows.map((r) => ({
              id: r.id.toString(),
              email: r.email,
              createdAt: r.created_at.toISOString(),
            })),
          },
        };
      }
      case 'members_all': {
        const rows = await this.prisma.members.findMany({
          orderBy: { full_name: 'asc' },
          take: 500,
          include: {
            users: { select: { email: true } },
            departments: { select: { name: true } },
          },
        });
        return {
          section: s,
          title: 'Tổng số thành viên',
          table: {
            columns: [
              col('userId', 'Hội viên'),
              col('fullName', 'Họ tên'),
              col('email', 'Email'),
              col('department', 'Ban'),
              col('status', 'Trạng thái'),
            ],
            rows: rows.map((m) => ({
              userId: m.user_id.toString(),
              fullName: m.full_name,
              email: m.users?.email ?? '—',
              department: m.departments?.name ?? '—',
              status: m.membership_status,
            })),
          },
        };
      }
      case 'members': {
        const rows = await this.prisma.members.findMany({
          where: { membership_status: members_membership_status.active },
          orderBy: { full_name: 'asc' },
          take: 500,
          include: {
            users: { select: { email: true } },
            departments: { select: { name: true } },
          },
        });
        return {
          section: s,
          title: 'Thành viên đang hoạt động',
          table: {
            columns: [
              col('userId', 'Hội viên'),
              col('fullName', 'Họ tên'),
              col('email', 'Email'),
              col('department', 'Ban'),
            ],
            rows: rows.map((m) => ({
              userId: m.user_id.toString(),
              fullName: m.full_name,
              email: m.users?.email ?? '—',
              department: m.departments?.name ?? '—',
            })),
          },
        };
      }
      case 'events_all': {
        const [list, byStatus] = await Promise.all([
          this.prisma.events.findMany({
            orderBy: { start_at: 'desc' },
            take: 200,
            include: {
              users: { select: { email: true } },
            },
          }),
          this.prisma.events.groupBy({
            by: ['status'],
            _count: { _all: true },
          }),
        ]);
        return {
          section: s,
          title: 'Tổng sự kiện (mẫu gần nhất)',
          chart: {
            kind: 'bar' as const,
            label: 'Số sự kiện theo trạng thái',
            points: byStatus
              .map((b) => ({
                label: String(b.status),
                value: b._count._all,
              }))
              .sort((a, b) => a.label.localeCompare(b.label)),
          },
          table: {
            columns: [
              col('id', 'ID'),
              col('title', 'Tiêu đề'),
              col('status', 'Trạng thái'),
              col('startAt', 'Bắt đầu'),
              col('creator', 'Người tạo'),
            ],
            rows: list.map((e) => ({
              id: e.id.toString(),
              title: e.title,
              status: e.status,
              startAt: e.start_at.toISOString(),
              creator: e.users?.email ?? '—',
            })),
          },
        };
      }
      case 'events_upcoming': {
        const list = await this.prisma.events.findMany({
          where: {
            start_at: { gte: now },
            status: { in: ['published', 'ongoing'] },
          },
          orderBy: { start_at: 'asc' },
          take: 200,
          include: { users: { select: { email: true } } },
        });
        return {
          section: s,
          title: 'Sự kiện sắp tới',
          table: {
            columns: [
              col('id', 'ID'),
              col('title', 'Tiêu đề'),
              col('status', 'Trạng thái'),
              col('startAt', 'Bắt đầu'),
              col('creator', 'Người tạo'),
            ],
            rows: list.map((e) => ({
              id: e.id.toString(),
              title: e.title,
              status: e.status,
              startAt: e.start_at.toISOString(),
              creator: e.users?.email ?? '—',
            })),
          },
        };
      }
      case 'registrations_approved': {
        const rows = await this.prisma.event_registrations.findMany({
          where: { status: 'approved' },
          orderBy: { created_at: 'desc' },
          take: 200,
          include: {
            events: { select: { id: true, title: true, start_at: true } },
            users_event_registrations_user_idTousers: {
              select: {
                email: true,
                members: { select: { full_name: true } },
              },
            },
            event_checkins: { select: { scanned_at: true } },
          },
        });
        return {
          section: s,
          title: 'Đăng ký đã duyệt (gần nhất)',
          table: {
            columns: [
              col('id', 'Mã ĐK'),
              col('eventId', 'Sự kiện'),
              col('eventTitle', 'Tên sự kiện'),
              col('member', 'Thành viên'),
              col('email', 'Email'),
              col('createdAt', 'Đăng ký lúc'),
              col('checkIn', 'Check-in'),
            ],
            rows: rows.map((r) => {
              const u = r.users_event_registrations_user_idTousers;
              return {
                id: r.id.toString(),
                eventId: r.events.id.toString(),
                eventTitle: r.events.title,
                member: u?.members?.full_name ?? '—',
                email: u?.email ?? '—',
                createdAt: r.created_at.toISOString(),
                checkIn: r.event_checkins?.scanned_at
                  ? r.event_checkins.scanned_at.toISOString()
                  : '—',
              };
            }),
          },
        };
      }
      case 'registrations_pending': {
        const rows = await this.prisma.event_registrations.findMany({
          where: { status: 'pending' },
          orderBy: { created_at: 'desc' },
          take: 200,
          include: {
            events: { select: { id: true, title: true, start_at: true } },
            users_event_registrations_user_idTousers: {
              select: { email: true, members: { select: { full_name: true } } },
            },
          },
        });
        return {
          section: s,
          title: 'Đăng ký chờ duyệt',
          table: {
            columns: [
              col('id', 'Mã ĐK'),
              col('eventId', 'Mã sự kiện'),
              col('eventTitle', 'Sự kiện'),
              col('member', 'Thành viên'),
              col('email', 'Email'),
              col('createdAt', 'Gửi lúc'),
            ],
            rows: rows.map((r) => {
              const u = r.users_event_registrations_user_idTousers;
              return {
                id: r.id.toString(),
                eventId: r.events.id.toString(),
                eventTitle: r.events.title,
                member: u?.members?.full_name ?? '—',
                email: u?.email ?? '—',
                createdAt: r.created_at.toISOString(),
              };
            }),
          },
        };
      }
      case 'checkins': {
        const [recent, inRange] = await Promise.all([
          this.prisma.event_checkins.findMany({
            orderBy: { scanned_at: 'desc' },
            take: 150,
            include: {
              events: { select: { id: true, title: true } },
              users: {
                select: { email: true, members: { select: { full_name: true } } },
              },
              event_registrations: {
                include: {
                  users_event_registrations_user_idTousers: {
                    select: {
                      email: true,
                      members: { select: { full_name: true } },
                    },
                  },
                },
              },
            },
          }),
          this.prisma.event_checkins.findMany({
            where: { scanned_at: { gte: sixMonthsAgo } },
            select: { scanned_at: true },
          }),
        ]);
        const buckets = new Map<string, number>();
        for (const c of inRange) {
          const d = c.scanned_at;
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          buckets.set(key, (buckets.get(key) ?? 0) + 1);
        }
        const monthKeys: string[] = [];
        for (let i = 5; i >= 0; i -= 1) {
          const d = new Date(now);
          d.setMonth(d.getMonth() - i);
          monthKeys.push(
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          );
        }
        const points = monthKeys.map((k) => ({
          label: k,
          value: buckets.get(k) ?? 0,
        }));
        return {
          section: s,
          title: 'Lượt check-in',
          chart: { kind: 'bar' as const, label: '6 tháng gần nhất', points },
          table: {
            columns: [
              col('id', 'ID'),
              col('eventId', 'Sự kiện'),
              col('eventTitle', 'Tên sự kiện'),
              col('attendee', 'Người tham dự'),
              col('email', 'Email'),
              col('scannedAt', 'Thời điểm'),
              col('scannedBy', 'Quét bởi'),
            ],
            rows: recent.map((c) => {
              const att = c.event_registrations.users_event_registrations_user_idTousers;
              return {
                id: c.id.toString(),
                eventId: c.events.id.toString(),
                eventTitle: c.events.title,
                attendee: att?.members?.full_name ?? '—',
                email: att?.email ?? '—',
                scannedAt: c.scanned_at.toISOString(),
                scannedBy: c.users?.members?.full_name ?? c.users?.email ?? '—',
              };
            }),
          },
        };
      }
      case 'participation_cancellations_pending': {
        const rows = await this.prisma.participation_cancellations.findMany({
          where: { status: 'pending' },
          orderBy: { created_at: 'desc' },
          take: 200,
          include: {
            events: { select: { id: true, title: true } },
            users_participation_cancellations_user_idTousers: {
              select: { email: true, members: { select: { full_name: true } } },
            },
          },
        });
        return {
          section: s,
          title: 'Hủy tham gia — chờ xử lý',
          table: {
            columns: [
              col('id', 'ID'),
              col('eventId', 'Sự kiện'),
              col('eventTitle', 'Tên sự kiện'),
              col('member', 'Thành viên'),
              col('email', 'Email'),
              col('reason', 'Lý do'),
              col('createdAt', 'Gửi lúc'),
            ],
            rows: rows.map((p) => {
              const u = p.users_participation_cancellations_user_idTousers;
              return {
                id: p.id.toString(),
                eventId: p.events.id.toString(),
                eventTitle: p.events.title,
                member: u?.members?.full_name ?? '—',
                email: u?.email ?? '—',
                reason: p.reason?.trim() || '—',
                createdAt: p.created_at.toISOString(),
              };
            }),
          },
        };
      }
      default:
        throw new BadRequestException('section không hợp lệ');
    }
  }

  listDepartments() {
    return this.prisma.departments.findMany({
      orderBy: { sort_order: 'asc' },
    });
  }

  listRoles() {
    return this.prisma.roles.findMany({
      orderBy: { hierarchy_level: 'asc' },
    });
  }
}
