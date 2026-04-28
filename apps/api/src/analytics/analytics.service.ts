import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { isClubLeadership } from '../auth/utils/has-role';
import { RequestUserPayload } from '../auth/types/request-user-payload';
import { toBigId } from '../common/utils/id';
import { PrismaService } from '../prisma/prisma.service';

type UserRow = {
  email: string;
  id: bigint;
  members: { full_name: string } | null;
};

type Agg = {
  userId: bigint;
  fullName: string;
  email: string;
  meetingOnTime: number;
  meetingLate: number;
  meetingOutOfWindow: number;
  meetingAbsent: number;
  eventCheckins: number;
  absenceApproved: number;
  participationCancelApproved: number;
  eventsParticipated: number;
  eventsPerfectParticipation: number;
};

const emptyAgg = (userId: bigint, fullName: string, email: string): Agg => ({
  userId,
  fullName,
  email,
  meetingOnTime: 0,
  meetingLate: 0,
  meetingOutOfWindow: 0,
  meetingAbsent: 0,
  eventCheckins: 0,
  absenceApproved: 0,
  participationCancelApproved: 0,
  eventsParticipated: 0,
  eventsPerfectParticipation: 0,
});

function nameFor(u: UserRow) {
  return u.members?.full_name?.trim() || u.email;
}

/** Điểm chỉ tính trên hoạt động có đăng ký (điểm danh / check-in gắn registration). Thành viên không đăng ký sự kiện không bị cộng/trừ cho sự kiện đó. */
function computeScore(a: Agg): number {
  return (
    a.meetingOnTime * 3 +
    a.eventCheckins * 2 +
    a.eventsPerfectParticipation * 2 -
    a.meetingLate * 2 -
    a.meetingOutOfWindow * 3 -
    a.meetingAbsent * 4 -
    a.absenceApproved * 1 -
    a.participationCancelApproved * 1
  );
}

const regWithUser = {
  include: {
    users_event_registrations_user_idTousers: {
      select: {
        email: true,
        id: true,
        members: { select: { full_name: true } },
      },
    },
  },
} as const;

/** Quý theo lịch dương (Q1=tháng 1–3, …). `lt` là mốc đầu quý sau (không bao gồm). */
function quarterRangeUtc(year: number, quarter: 1 | 2 | 3 | 4) {
  const startMonth = (quarter - 1) * 3;
  const gte = new Date(Date.UTC(year, startMonth, 1, 0, 0, 0, 0));
  const lt = new Date(Date.UTC(year, startMonth + 3, 1, 0, 0, 0, 0));
  return { gte, lt };
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureLeadership(u: RequestUserPayload) {
    if (!isClubLeadership(u.roleCodes)) {
      throw new ForbiddenException('Chỉ lãnh đạo/điều hành mới xem thống kê này');
    }
  }

  private getOrInit(
    map: Map<bigint, Agg>,
    userId: bigint,
    fullName: string,
    email: string,
  ): Agg {
    if (!map.has(userId)) {
      map.set(userId, emptyAgg(userId, fullName, email));
    } else {
      const cur = map.get(userId)!;
      if (!cur.fullName && fullName) {
        cur.fullName = fullName;
      }
    }
    return map.get(userId)!;
  }

  async memberDiscipline(
    u: RequestUserPayload,
    opts: {
      eventIdParam?: string;
      period?: 'all' | 'quarter';
      year?: number;
      quarter?: number;
    },
  ): Promise<{
    generatedAt: string;
    scope: {
      eventId: string | null;
      period: 'all' | 'quarter';
      year: number | null;
      quarter: 1 | 2 | 3 | 4 | null;
      dateFrom: string | null;
      dateToExclusive: string | null;
      description: string;
    };
    ranking: {
      rank: number;
      userId: string;
      fullName: string;
      email: string;
      score: number;
      meetingOnTime: number;
      meetingLate: number;
      meetingOutOfWindow: number;
      meetingAbsent: number;
      eventCheckins: number;
      absenceApproved: number;
      participationCancelApproved: number;
      eventsParticipated: number;
      eventsPerfectParticipation: number;
    }[];
  }> {
    this.ensureLeadership(u);
    const period = opts.period ?? 'all';
    const now = new Date();
    const defaultY = now.getUTCFullYear();
    const defaultQ = (Math.floor(now.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;

    let eventIds: bigint[] | null = null;
    let dateFrom: Date | null = null;
    let dateToExclusive: Date | null = null;
    let scopeYear: number | null = null;
    let scopeQuarter: 1 | 2 | 3 | 4 | null = null;
    let description: string;

    if (opts.eventIdParam) {
      const eid = toBigId(opts.eventIdParam, 'eventId');
      eventIds = [eid];
      description =
        'Một sự kiện cụ thể (điểm danh, check-in, nghỉ, hủy tham gia trong phạm vi sự kiện đó).';
    } else if (period === 'quarter') {
      const y = opts.year ?? defaultY;
      const q = (opts.quarter ?? defaultQ) as number;
      if (!Number.isInteger(q) || q < 1 || q > 4) {
        throw new BadRequestException('quarter must be 1–4');
      }
      if (!Number.isInteger(y) || y < 1970 || y > 2100) {
        throw new BadRequestException('invalid year');
      }
      scopeYear = y;
      scopeQuarter = q as 1 | 2 | 3 | 4;
      const r = quarterRangeUtc(y, scopeQuarter);
      dateFrom = r.gte;
      dateToExclusive = r.lt;
      const rows = await this.prisma.events.findMany({
        where: {
          start_at: { gte: r.gte, lt: r.lt },
        },
        select: { id: true },
      });
      eventIds = rows.map((x) => x.id);
      description = `Sự kiện có thời điểm bắt đầu trong quý ${q}/${y} (lọc theo \`events.start_at\`).`;
    } else {
      description =
        'Toàn bộ thời gian — mọi sự kiện trong dữ liệu (không lọc theo quý).';
    }

    const eventInList = (
      ids: bigint[] | null,
    ): Prisma.event_registrationsWhereInput['event_id'] => {
      if (ids === null) {
        return undefined;
      }
      return { in: ids };
    };

    const meetingAttWhere: Prisma.meeting_attendancesWhereInput = {
      event_meetings: {
        status: 'scheduled',
        ...(eventIds !== null ? { event_id: { in: eventIds } } : {}),
      },
    };

    const checkinWhere: Prisma.event_checkinsWhereInput =
      eventIds !== null ? { event_id: { in: eventIds } } : {};

    const absWhere: Prisma.absence_requestsWhereInput = {
      status: 'approved',
      ...(eventIds !== null ? { event_id: { in: eventIds } } : {}),
    };

    const partWhere: Prisma.participation_cancellationsWhereInput = {
      status: 'approved',
      ...(eventIds !== null ? { event_id: { in: eventIds } } : {}),
    };

    const meetingWhere: Prisma.event_meetingsWhereInput = {
      status: 'scheduled',
      ...(eventIds !== null ? { event_id: { in: eventIds } } : {}),
    };

    const evRegFilter = eventInList(eventIds);
    const regWhere: Prisma.event_registrationsWhereInput = {
      status: 'approved',
      ...(evRegFilter ? { event_id: evRegFilter } : {}),
    };

    const map = new Map<bigint, Agg>();

    const [
      meetingRows,
      checkinRows,
      absRows,
      partRows,
      meetings,
      approvedRegs,
    ] = await Promise.all([
      this.prisma.meeting_attendances.findMany({
        where: meetingAttWhere,
        include: {
          event_registrations: regWithUser,
          event_meetings: { select: { event_id: true, title: true } },
        },
      }),
      this.prisma.event_checkins.findMany({
        where: checkinWhere,
        include: { event_registrations: regWithUser },
      }),
      this.prisma.absence_requests.findMany({
        where: absWhere,
        include: {
          users_absence_requests_user_idTousers: {
            select: {
              email: true,
              id: true,
              members: { select: { full_name: true } },
            },
          },
        },
      }),
      this.prisma.participation_cancellations.findMany({
        where: partWhere,
        include: {
          users_participation_cancellations_user_idTousers: {
            select: {
              email: true,
              id: true,
              members: { select: { full_name: true } },
            },
          },
        },
      }),
      this.prisma.event_meetings.findMany({
        where: meetingWhere,
        select: { id: true, event_id: true, title: true },
      }),
      this.prisma.event_registrations.findMany({
        where: regWhere,
        select: { id: true, event_id: true, user_id: true },
      }),
    ]);

    for (const a of meetingRows) {
      const r = a.event_registrations?.users_event_registrations_user_idTousers;
      if (!r) {
        continue;
      }
      const agg = this.getOrInit(map, r.id, nameFor(r), r.email);
      if (a.result === 'on_time') {
        agg.meetingOnTime += 1;
      } else if (a.result === 'late') {
        agg.meetingLate += 1;
      } else {
        agg.meetingOutOfWindow += 1;
      }
    }

    for (const c of checkinRows) {
      const r = c.event_registrations?.users_event_registrations_user_idTousers;
      if (!r) {
        continue;
      }
      const agg = this.getOrInit(map, r.id, nameFor(r), r.email);
      agg.eventCheckins += 1;
    }

    for (const ab of absRows) {
      const row = ab.users_absence_requests_user_idTousers;
      const agg = this.getOrInit(map, row.id, nameFor(row), row.email);
      agg.absenceApproved += 1;
    }

    for (const p of partRows) {
      const row = p.users_participation_cancellations_user_idTousers;
      const agg = this.getOrInit(map, row.id, nameFor(row), row.email);
      agg.participationCancelApproved += 1;
    }

    const uniqueUserIds = Array.from(new Set(approvedRegs.map((x) => x.user_id)));
    const userRows =
      uniqueUserIds.length > 0
        ? await this.prisma.users.findMany({
            where: { id: { in: uniqueUserIds } },
            select: {
              id: true,
              email: true,
              members: { select: { full_name: true } },
            },
          })
        : [];
    const userById = new Map(userRows.map((x) => [x.id, x]));

    for (const m of meetings) {
      const regs = approvedRegs.filter((r) => r.event_id === m.event_id);
      const attended = new Set(
        meetingRows
          .filter((row) => row.meeting_id === m.id)
          .map((row) => row.registration_id),
      );
      for (const reg of regs) {
        if (attended.has(reg.id)) {
          continue;
        }
        const urow = userById.get(reg.user_id);
        if (!urow) {
          continue;
        }
        const fn = nameFor({
          id: urow.id,
          email: urow.email,
          members: urow.members,
        });
        const agg = this.getOrInit(map, urow.id, fn, urow.email);
        agg.meetingAbsent += 1;
      }
    }

    const meetingsByEvent = new Map<bigint, bigint[]>();
    for (const m of meetings) {
      const list = meetingsByEvent.get(m.event_id) ?? [];
      list.push(m.id);
      meetingsByEvent.set(m.event_id, list);
    }

    const checkinRegIds = new Set(checkinRows.map((c) => c.registration_id));
    const onTimeSet = new Set(
      meetingRows
        .filter((a) => a.result === 'on_time')
        .map((a) => `${a.meeting_id}-${a.registration_id}`),
    );

    const eventsParticipatedByUser = new Map<bigint, Set<bigint>>();
    for (const c of checkinRows) {
      const r = c.event_registrations?.users_event_registrations_user_idTousers;
      if (!r) {
        continue;
      }
      const set = eventsParticipatedByUser.get(r.id) ?? new Set<bigint>();
      set.add(c.event_id);
      eventsParticipatedByUser.set(r.id, set);
    }

    const perfectByUser = new Map<bigint, number>();
    for (const reg of approvedRegs) {
      if (!checkinRegIds.has(reg.id)) {
        continue;
      }
      const mids = meetingsByEvent.get(reg.event_id) ?? [];
      let ok: boolean;
      if (mids.length === 0) {
        ok = true;
      } else {
        ok = mids.every((mid) => onTimeSet.has(`${mid}-${reg.id}`));
      }
      if (ok) {
        const uid = reg.user_id;
        perfectByUser.set(uid, (perfectByUser.get(uid) ?? 0) + 1);
      }
    }

    const activeMembers = await this.prisma.members.findMany({
      where: { membership_status: 'active' },
      include: {
        users: { select: { email: true, id: true } },
      },
    });
    for (const m of activeMembers) {
      const email = m.users?.email ?? '';
      this.getOrInit(map, m.user_id, m.full_name.trim(), email);
    }

    for (const [uid, agg] of map) {
      agg.eventsParticipated = eventsParticipatedByUser.get(uid)?.size ?? 0;
      agg.eventsPerfectParticipation = perfectByUser.get(uid) ?? 0;
    }

    const ranking = Array.from(map.values())
      .map((row) => ({
        userId: row.userId.toString(),
        fullName: row.fullName,
        email: row.email,
        score: computeScore(row),
        meetingOnTime: row.meetingOnTime,
        meetingLate: row.meetingLate,
        meetingOutOfWindow: row.meetingOutOfWindow,
        meetingAbsent: row.meetingAbsent,
        eventCheckins: row.eventCheckins,
        absenceApproved: row.absenceApproved,
        participationCancelApproved: row.participationCancelApproved,
        eventsParticipated: row.eventsParticipated,
        eventsPerfectParticipation: row.eventsPerfectParticipation,
      }))
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        if (b.eventsParticipated !== a.eventsParticipated) {
          return b.eventsParticipated - a.eventsParticipated;
        }
        return a.fullName.localeCompare(b.fullName, 'vi');
      })
      .map((row, i) => ({ ...row, rank: i + 1 }));

    return {
      generatedAt: new Date().toISOString(),
      scope: {
        eventId: opts.eventIdParam ?? null,
        period,
        year: scopeYear,
        quarter: scopeQuarter,
        dateFrom: dateFrom?.toISOString() ?? null,
        dateToExclusive: dateToExclusive?.toISOString() ?? null,
        description,
      },
      ranking,
    };
  }

  private ensureSelfOrStaff(u: RequestUserPayload, target: bigint) {
    if (isClubLeadership(u.roleCodes) || u.id === target) {
      return;
    }
    throw new ForbiddenException();
  }

  private async buildAggForSingleUser(
    userId: bigint,
    eventIds: bigint[] | null,
  ): Promise<Agg> {
    const u = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { email: true, members: { select: { full_name: true } } },
    });
    if (!u) {
      throw new NotFoundException();
    }
    const fullName = nameFor({
      id: userId,
      email: u.email,
      members: u.members,
    });
    if (eventIds !== null && eventIds.length === 0) {
      return emptyAgg(userId, fullName, u.email);
    }
    const eventIn = (
      ids: bigint[] | null,
    ): Prisma.event_registrationsWhereInput['event_id'] => {
      if (ids == null) {
        return undefined;
      }
      return { in: ids };
    };
    const evRegFilter = eventIn(eventIds);
    const regWhere: Prisma.event_registrationsWhereInput = {
      user_id: userId,
      status: 'approved',
      ...(evRegFilter ? { event_id: evRegFilter } : {}),
    };

    const absWhere: Prisma.absence_requestsWhereInput = {
      status: 'approved',
      user_id: userId,
      ...(eventIds ? { event_id: { in: eventIds } } : {}),
    };
    const partWhere: Prisma.participation_cancellationsWhereInput = {
      status: 'approved',
      user_id: userId,
      ...(eventIds ? { event_id: { in: eventIds } } : {}),
    };
    const meetingWhere: Prisma.event_meetingsWhereInput = {
      status: 'scheduled',
      ...(eventIds ? { event_id: { in: eventIds } } : {}),
    };

    const [meetingRows, checkinRows, absRows, partRows, meetings, approvedRegs] =
      await Promise.all([
        this.prisma.meeting_attendances.findMany({
          where: {
            event_registrations: { user_id: userId, status: 'approved', ...(evRegFilter ? { event_id: eventIn(eventIds) } : {}) },
            event_meetings: { status: 'scheduled', ...(eventIds ? { event_id: { in: eventIds } } : {}) },
          },
          include: {
            event_registrations: regWithUser,
            event_meetings: { select: { event_id: true, title: true } },
          },
        }),
        this.prisma.event_checkins.findMany({
          where: {
            event_registrations: { user_id: userId, status: 'approved', ...(evRegFilter ? { event_id: eventIn(eventIds) } : {}) },
            ...(eventIds ? { event_id: { in: eventIds } } : {}),
          },
          include: { event_registrations: regWithUser },
        }),
        this.prisma.absence_requests.findMany({
          where: absWhere,
          include: {
            users_absence_requests_user_idTousers: {
              select: {
                email: true,
                id: true,
                members: { select: { full_name: true } },
              },
            },
          },
        }),
        this.prisma.participation_cancellations.findMany({
          where: partWhere,
          include: {
            users_participation_cancellations_user_idTousers: {
              select: {
                email: true,
                id: true,
                members: { select: { full_name: true } },
              },
            },
          },
        }),
        this.prisma.event_meetings.findMany({
          where: meetingWhere,
          select: { id: true, event_id: true, title: true },
        }),
        this.prisma.event_registrations.findMany({
          where: regWhere,
          select: { id: true, event_id: true, user_id: true },
        }),
      ]);
    const map = new Map<bigint, Agg>();
    for (const a of meetingRows) {
      const r = a.event_registrations?.users_event_registrations_user_idTousers;
      if (!r) {
        continue;
      }
      const agg = this.getOrInit(map, r.id, nameFor(r), r.email);
      if (a.result === 'on_time') {
        agg.meetingOnTime += 1;
      } else if (a.result === 'late') {
        agg.meetingLate += 1;
      } else {
        agg.meetingOutOfWindow += 1;
      }
    }
    for (const c of checkinRows) {
      const r = c.event_registrations?.users_event_registrations_user_idTousers;
      if (!r) {
        continue;
      }
      const agg = this.getOrInit(map, r.id, nameFor(r), r.email);
      agg.eventCheckins += 1;
    }
    for (const ab of absRows) {
      const row = ab.users_absence_requests_user_idTousers;
      const agg = this.getOrInit(map, row.id, nameFor(row), row.email);
      agg.absenceApproved += 1;
    }
    for (const p of partRows) {
      const row = p.users_participation_cancellations_user_idTousers;
      const agg = this.getOrInit(map, row.id, nameFor(row), row.email);
      agg.participationCancelApproved += 1;
    }
    this.getOrInit(map, userId, fullName, u.email);
    const checkinRegIds = new Set(checkinRows.map((c) => c.registration_id));
    const onTimeSet = new Set(
      meetingRows
        .filter((a) => a.result === 'on_time')
        .map((a) => `${a.meeting_id}-${a.registration_id}`),
    );
    for (const m of meetings) {
      const regs = approvedRegs.filter((r) => r.event_id === m.event_id);
      const attended = new Set(
        meetingRows
          .filter((row) => row.meeting_id === m.id)
          .map((row) => row.registration_id),
      );
      for (const reg of regs) {
        if (attended.has(reg.id)) {
          continue;
        }
        const urow = { id: userId, email: u.email, members: { full_name: fullName } };
        const fn = nameFor({ id: urow.id, email: urow.email, members: { full_name: fullName } } as UserRow);
        const agg = this.getOrInit(map, urow.id, fn, urow.email);
        agg.meetingAbsent += 1;
      }
    }
    const meetingsByEvent = new Map<bigint, bigint[]>();
    for (const m of meetings) {
      const list = meetingsByEvent.get(m.event_id) ?? [];
      list.push(m.id);
      meetingsByEvent.set(m.event_id, list);
    }
    const eventsParticipatedByUser = new Map<bigint, Set<bigint>>();
    for (const c of checkinRows) {
      const r = c.event_registrations?.users_event_registrations_user_idTousers;
      if (!r) {
        continue;
      }
      const set = eventsParticipatedByUser.get(r.id) ?? new Set<bigint>();
      set.add(c.event_id);
      eventsParticipatedByUser.set(r.id, set);
    }
    const perfectByUser = new Map<bigint, number>();
    for (const reg of approvedRegs) {
      if (!checkinRegIds.has(reg.id)) {
        continue;
      }
      const mids = meetingsByEvent.get(reg.event_id) ?? [];
      let ok: boolean;
      if (mids.length === 0) {
        ok = true;
      } else {
        ok = mids.every((mid) => onTimeSet.has(`${mid}-${reg.id}`));
      }
      if (ok) {
        const uid = reg.user_id;
        perfectByUser.set(uid, (perfectByUser.get(uid) ?? 0) + 1);
      }
    }
    const row = map.get(userId) ?? emptyAgg(userId, fullName, u.email);
    row.eventsParticipated = eventsParticipatedByUser.get(userId)?.size ?? 0;
    row.eventsPerfectParticipation = perfectByUser.get(userId) ?? 0;
    return row;
  }

  async memberEngagementProfile(
    u: RequestUserPayload,
    targetUserId: string,
  ) {
    const id = toBigId(targetUserId, 'userId');
    this.ensureSelfOrStaff(u, id);
    const m = await this.prisma.members.findUnique({
      where: { user_id: id },
      include: {
        departments: true,
        users: {
          select: {
            email: true,
            id: true,
            last_login_at: true,
            is_active: true,
          },
        },
      },
    });
    if (!m) {
      throw new NotFoundException();
    }
    const now = new Date();
    const defaultQ = (Math.floor(now.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;
    const y = now.getUTCFullYear();
    const qRange = quarterRangeUtc(y, defaultQ);
    const quarterEventRows = await this.prisma.events.findMany({
      where: { start_at: { gte: qRange.gte, lt: qRange.lt } },
      select: { id: true },
    });
    const quarterEventIds = quarterEventRows.map((x) => x.id);
    const joinAt = m.created_at;
    const eventSinceJoin = await this.prisma.events.findMany({
      where: {
        start_at: { gte: joinAt },
        status: { not: 'draft' as const },
      },
      select: { id: true, title: true, start_at: true, status: true },
    });
    const sinceJoinIds = eventSinceJoin.map((x) => x.id);
    const [aggQuarter, aggSince] = await Promise.all([
      this.buildAggForSingleUser(id, quarterEventIds),
      this.buildAggForSingleUser(id, sinceJoinIds),
    ]);
    const regsWithEvents = await this.prisma.event_registrations.findMany({
      where: {
        user_id: id,
        status: 'approved',
        event_id: { in: sinceJoinIds },
      },
      include: { events: { select: { id: true, title: true, start_at: true, status: true } } },
    });
    const checkinRegs = new Set<bigint>();
    (await this.prisma.event_checkins.findMany({
      where: {
        event_registrations: { user_id: id, status: 'approved' },
        event_id: { in: sinceJoinIds },
      },
      select: { registration_id: true },
    })).forEach((c) => checkinRegs.add(c.registration_id));
    const nowT = now.getTime();
    let checkedIn = 0;
    let regFuture = 0;
    let regPastNoCheckin = 0;
    const seen = new Set<string>();
    for (const r of regsWithEvents) {
      if (!r.events) {
        continue;
      }
      const eid = r.event_id.toString();
      if (seen.has(eid)) {
        continue;
      }
      seen.add(eid);
      const t = r.events.start_at.getTime();
      const has = checkinRegs.has(r.id);
      if (has) {
        checkedIn += 1;
      } else if (t > nowT) {
        regFuture += 1;
      } else {
        regPastNoCheckin += 1;
      }
    }
    const participationPie = [
      { key: 'checked_in' as const, name: 'Đã check-in tham dự', value: checkedIn },
      { key: 'registered_upcoming' as const, name: 'Đã đăng ký, sự kiện chưa tới', value: regFuture },
      { key: 'registered_missed' as const, name: 'Đã đăng ký, đã tới mốc mà chưa check-in', value: regPastNoCheckin },
    ].filter((s) => s.value > 0);
    const conductColors = {
      onTime: aggSince.meetingOnTime,
      late: aggSince.meetingLate,
      oow: aggSince.meetingOutOfWindow,
      absent: aggSince.meetingAbsent,
      absence: aggSince.absenceApproved,
      cancel: aggSince.participationCancelApproved,
    };
    const conductPie = [
      { key: 'on_time' as const, name: 'Buổi họp: Đúng giờ', value: conductColors.onTime },
      { key: 'late' as const, name: 'Buổi họp: Trễ', value: conductColors.late },
      { key: 'oow' as const, name: 'Buổi họp: Ngoài khung quét', value: conductColors.oow },
      { key: 'absent' as const, name: 'Buổi họp: Vắng (có lịch)', value: conductColors.absent },
      { key: 'absence' as const, name: 'Xin nghỉ (đã duyệt)', value: conductColors.absence },
      { key: 'cancel' as const, name: 'Hủy tham gia (đã duyệt)', value: conductColors.cancel },
    ].filter((s) => s.value > 0);
    const eventRowsForLists = await this.prisma.event_registrations.findMany({
      where: { user_id: id, status: 'approved' },
      include: { events: { select: { id: true, title: true, start_at: true, status: true, expected_end_at: true } } },
      orderBy: { events: { start_at: 'desc' } },
    });
    const withCheckin = new Set<bigint>();
    (await this.prisma.event_checkins.findMany({
      where: { event_registrations: { user_id: id, status: 'approved' } },
      select: { event_id: true },
    })).forEach((c) => withCheckin.add(c.event_id));
    const upcoming: {
      eventId: string;
      title: string;
      startAt: string;
      status: string;
      hasCheckin: boolean;
    }[] = [];
    const past: typeof upcoming = [];
    for (const r of eventRowsForLists) {
      if (!r.events) {
        continue;
      }
      const ev = r.events;
      const item = {
        eventId: ev.id.toString(),
        title: ev.title,
        startAt: ev.start_at.toISOString(),
        status: ev.status,
        hasCheckin: withCheckin.has(ev.id),
      };
      if (ev.start_at.getTime() > nowT) {
        upcoming.push(item);
      } else {
        past.push(item);
      }
    }
    const scoreQuarter = computeScore(aggQuarter);
    const scoreSinceJoin = computeScore(aggSince);
    return {
      generatedAt: now.toISOString(),
      profile: {
        userId: m.user_id.toString(),
        fullName: m.full_name,
        email: m.users?.email ?? null,
        gender: m.gender,
        birthDate: m.birth_date,
        major: m.major,
        phone: m.phone,
        positionTitle: m.position_title,
        primaryDepartment: m.departments
          ? {
              id: m.departments.id,
              code: m.departments.code,
              name: m.departments.name,
            }
          : null,
        membershipStatus: m.membership_status,
        joinedAt: m.created_at.toISOString(),
        lastLoginAt: m.users?.last_login_at?.toISOString() ?? null,
        isActive: m.users?.is_active,
      },
      quarter: {
        year: y,
        quarter: defaultQ,
        label: `Q${defaultQ}/${y}`,
        score: scoreQuarter,
        meetingOnTime: aggQuarter.meetingOnTime,
        meetingLate: aggQuarter.meetingLate,
        meetingOutOfWindow: aggQuarter.meetingOutOfWindow,
        meetingAbsent: aggQuarter.meetingAbsent,
        eventCheckins: aggQuarter.eventCheckins,
        absenceApproved: aggQuarter.absenceApproved,
        participationCancelApproved: aggQuarter.participationCancelApproved,
        eventsParticipated: aggQuarter.eventsParticipated,
        eventsPerfectParticipation: aggQuarter.eventsPerfectParticipation,
      },
      sinceJoin: {
        label: 'Từ khi gia nhập (sự kiện không ở trạng thái nháp)',
        score: scoreSinceJoin,
        meetingOnTime: aggSince.meetingOnTime,
        meetingLate: aggSince.meetingLate,
        meetingOutOfWindow: aggSince.meetingOutOfWindow,
        meetingAbsent: aggSince.meetingAbsent,
        eventCheckins: aggSince.eventCheckins,
        absenceApproved: aggSince.absenceApproved,
        participationCancelApproved: aggSince.participationCancelApproved,
        eventsParticipated: aggSince.eventsParticipated,
        eventsPerfectParticipation: aggSince.eventsPerfectParticipation,
      },
      participationPie,
      conductPie,
      events: {
        upcoming: upcoming.sort(
          (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
        ),
        past,
      },
    };
  }
}
