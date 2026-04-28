import {

  BadRequestException,

  ConflictException,

  ForbiddenException,

  Injectable,

  NotFoundException,

} from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { RequestUserPayload } from '../auth/types/request-user-payload';

import { isClubLeadership, isDeptOrCenterHead } from '../auth/utils/has-role';

import { toBigId } from '../common/utils/id';

import {

  CreateClubMeetingDto,

  DecideClubMeetingAbsenceDto,

  RequestClubMeetingAbsenceDto,

} from './dto/club-meeting.dto';



const includeCreator = {

  users: {

    select: { email: true, id: true, members: { select: { full_name: true } } },

  },

} satisfies Prisma.club_meetingsInclude;



type ClubIncludeList = {

  users: (typeof includeCreator)['users'];

  invitees: { select: { user_id: true } };

  absence_requests: {

    where: { user_id: bigint };

    take: number;

    orderBy: { created_at: 'desc' };

  };

};



type ClubMeetListRow = Prisma.club_meetingsGetPayload<{

  include: ClubIncludeList;

}>;



type ClubMeetCreateRow = Prisma.club_meetingsGetPayload<{

  include: {

    users: (typeof includeCreator)['users'];

    invitees: { select: { user_id: true } };

  };

}>;



@Injectable()

export class ClubMeetingsService {

  constructor(private readonly prisma: PrismaService) {}



  private assertLeadership(u: RequestUserPayload) {

    if (!isClubLeadership(u.roleCodes)) {

      throw new ForbiddenException('Chỉ ban chủ nhiệm / ban điều hành mới thao tác');

    }

  }



  /** Quyền xem buổi trong danh sách (BCH xem toàn bộ). */

  private userSeesClubMeeting(

    u: RequestUserPayload,

    m: {

      mandatory_scope: 'all_members' | 'club_leadership' | 'dept_heads_only' | 'selected_members';

      created_by: bigint;

      invitees: { user_id: bigint }[];

    },

  ): boolean {

    if (isClubLeadership(u.roleCodes)) {

      return true;

    }

    switch (m.mandatory_scope) {

      case 'all_members':

        return true;

      case 'club_leadership':

        return isClubLeadership(u.roleCodes);

      case 'dept_heads_only':

        return isDeptOrCenterHead(u.roleCodes);

      case 'selected_members':

        if (m.created_by === u.id) {

          return true;

        }

        return m.invitees.some((x) => x.user_id === u.id);

      default:

        return false;

    }

  }



  /** Đủ điều kiện xin vắng theo phạm vi bắt buộc (không ưu tiên BCH nếu không thuộc danh sách mời). */

  private userInMandatoryAttendanceAudience(

    u: RequestUserPayload,

    m: {

      mandatory_scope: 'all_members' | 'club_leadership' | 'dept_heads_only' | 'selected_members';

      invitees: { user_id: bigint }[];

    },

  ): boolean {

    switch (m.mandatory_scope) {

      case 'all_members':

        return true;

      case 'club_leadership':

        return isClubLeadership(u.roleCodes);

      case 'dept_heads_only':

        return isDeptOrCenterHead(u.roleCodes);

      case 'selected_members':

        return m.invitees.some((x) => x.user_id === u.id);

      default:

        return false;

    }

  }



  private serializeClubMeeting(m: ClubMeetListRow, u: RequestUserPayload) {

    const lead = isClubLeadership(u.roleCodes);

    const base = {

      id: m.id.toString(),

      source: 'club' as const,

      title: m.title,

      detail: m.detail,

      kind: m.kind,

      mandatoryScope: m.mandatory_scope,

      startAt: m.start_at,

      endAt: m.end_at,

      status: m.status,

      cancelledAt: m.cancelled_at,

      createdBy: m.created_by.toString(),

      creatorEmail: m.users?.email,

      creatorName: m.users?.members?.full_name?.trim() ?? null,

      createdAt: m.created_at,

      updatedAt: m.updated_at,

    };

    const mine = m.absence_requests[0];

    const inviteeIds = m.invitees.map((x) => x.user_id.toString());

    return {

      ...base,

      eventId: null as null,

      eventTitle: null as null,

      eventMeetingType: null as null,

      invitedUserIds: lead ? inviteeIds : undefined,

      imInInviteeList:

        m.mandatory_scope === 'selected_members'

          ? m.invitees.some((x) => x.user_id === u.id)

          : undefined,

      inviteeCount:

        m.mandatory_scope === 'selected_members' ? m.invitees.length : undefined,

      myAbsenceRequest: mine

        ? {

            id: mine.id.toString(),

            status: mine.status,

            reason: mine.reason,

            createdAt: mine.created_at,

          }

        : null,

    };

  }



  private serializeCreatedClub(m: ClubMeetCreateRow, u: RequestUserPayload) {

    const listLike = {

      ...m,

      absence_requests: [] as never[],

    } as ClubMeetListRow;

    return this.serializeClubMeeting(listLike, u);

  }



  private serializeEventMeeting(

    m: Prisma.event_meetingsGetPayload<{

      include: {

        events: { select: { id: true; title: true; status: true } };

        users: (typeof includeCreator)['users'];

      };

    }>,

  ) {

    const k = m.meeting_type === 'in_event' ? 'event_in' : 'event_pre';

    return {

      id: m.id.toString(),

      source: 'event' as const,

      eventId: m.event_id.toString(),

      eventTitle: m.events.title,

      title: m.title,

      detail: m.reason,

      kind: k,

      mandatoryScope: 'event_attendees' as const,

      startAt: m.start_at,

      endAt: m.end_at,

      status: m.status,

      cancelledAt: m.cancelled_at,

      createdBy: m.created_by.toString(),

      creatorEmail: m.users?.email,

      creatorName: m.users?.members?.full_name?.trim() ?? null,

      createdAt: m.created_at,

      updatedAt: m.created_at,

      invitedUserIds: undefined as undefined,

      imInInviteeList: undefined as undefined,

      inviteeCount: undefined as undefined,

      myAbsenceRequest: null as null,

      eventMeetingType: m.meeting_type,

    };

  }



  async list(u: RequestUserPayload) {

    const lead = isClubLeadership(u.roleCodes);

    const includeList = {

      users: includeCreator.users,

      invitees: { select: { user_id: true } },

      absence_requests: {

        where: { user_id: u.id },

        take: 1,

        orderBy: { created_at: 'desc' } as const,

      },

    } satisfies Prisma.club_meetingsInclude;



    let clubRows: ClubMeetListRow[];



    if (lead) {

      clubRows = await this.prisma.club_meetings.findMany({

        where: {},

        include: includeList,

        orderBy: { start_at: 'asc' },

      });

    } else {

      const raw = await this.prisma.club_meetings.findMany({

        where: {

          OR: [

            { mandatory_scope: 'all_members' },

            { created_by: u.id },

            {

              mandatory_scope: 'selected_members',

              invitees: { some: { user_id: u.id } },

            },

            { mandatory_scope: 'club_leadership' },

            { mandatory_scope: 'dept_heads_only' },

          ],

        },

        include: includeList,

        orderBy: { start_at: 'asc' },

      });

      clubRows = raw.filter((m) => this.userSeesClubMeeting(u, m));

    }



    const eventRows = await this.listEventMeetingsForHub(u);

    const a = clubRows.map((m) => this.serializeClubMeeting(m, u));

    const b = eventRows.map((m) => this.serializeEventMeeting(m));

    return [...a, ...b].sort(

      (x, y) =>

        new Date(x.startAt as string | number | Date).getTime() -

        new Date(y.startAt as string | number | Date).getTime(),

    );

  }



  private async listEventMeetingsForHub(u: RequestUserPayload) {

    const rows = await this.prisma.event_meetings.findMany({

      include: {

        events: { select: { id: true, title: true, status: true } },

        users: includeCreator.users,

      },

      orderBy: { start_at: 'asc' },

    });

    if (rows.length === 0) {

      return [];

    }

    const eventIds = [...new Set(rows.map((r) => r.event_id))];

    const lead = isClubLeadership(u.roleCodes);

    if (lead) {

      return rows.filter((r) => r.events.status !== 'cancelled');

    }

    const [managers, approvedRegs] = await Promise.all([

      this.prisma.event_managers.findMany({

        where: { user_id: u.id, event_id: { in: eventIds } },

        select: { event_id: true },

      }),

      this.prisma.event_registrations.findMany({

        where: {

          user_id: u.id,

          event_id: { in: eventIds },

          status: 'approved',

        },

        select: { event_id: true },

      }),

    ]);

    const mgrSet = new Set(managers.map((m) => m.event_id.toString()));

    const regSet = new Set(approvedRegs.map((r) => r.event_id.toString()));



    return rows.filter((em) => {

      const ev = em.events;

      if (ev.status === 'cancelled') {

        return false;

      }

      const eid = em.event_id.toString();

      if (mgrSet.has(eid)) {

        return true;

      }

      if (ev.status === 'draft') {

        return false;

      }

      return regSet.has(eid);

    });

  }



  async create(dto: CreateClubMeetingDto, u: RequestUserPayload) {

    this.assertLeadership(u);

    const start = new Date(dto.startAt);

    const end = new Date(dto.endAt);

    if (end <= start) {

      throw new BadRequestException('endAt phải sau startAt');

    }



    if (dto.mandatoryScope === 'selected_members') {

      const raw = dto.invitedUserIds?.map((x) => x.trim()).filter(Boolean) ?? [];

      if (raw.length === 0) {

        throw new BadRequestException(

          'Khi phạm vi «Chọn thành viên», cần chọn ít nhất một người (invitedUserIds)',

        );

      }

      const unique = [...new Set(raw)];

      const bigs = unique.map((id) => toBigId(id, 'userId'));

      const found = await this.prisma.users.findMany({

        where: { id: { in: bigs } },

        select: { id: true },

      });

      if (found.length !== bigs.length) {

        throw new BadRequestException('Có mã thành viên (user id) không tồn tại');

      }

      const row = await this.prisma.$transaction(async (tx) => {

        const m = await tx.club_meetings.create({

          data: {

            title: dto.title.trim(),

            detail: dto.detail?.trim() ? dto.detail.trim() : null,

            kind: dto.kind,

            mandatory_scope: 'selected_members',

            start_at: start,

            end_at: end,

            status: 'scheduled',

            created_by: u.id,

          },

        });

        await tx.club_meeting_invitees.createMany({

          data: bigs.map((uid) => ({

            club_meeting_id: m.id,

            user_id: uid,

          })),

          skipDuplicates: true,

        });

        return tx.club_meetings.findUniqueOrThrow({

          where: { id: m.id },

          include: { ...includeCreator, invitees: { select: { user_id: true } } },

        });

      });

      return this.serializeCreatedClub(row, u);

    }



    if (dto.invitedUserIds?.length) {

      throw new BadRequestException('invitedUserIds chỉ dùng khi phạm vi là chọn thành viên');

    }



    const row = await this.prisma.club_meetings.create({

      data: {

        title: dto.title.trim(),

        detail: dto.detail?.trim() ? dto.detail.trim() : null,

        kind: dto.kind,

        mandatory_scope: dto.mandatoryScope,

        start_at: start,

        end_at: end,

        status: 'scheduled',

        created_by: u.id,

      },

      include: { ...includeCreator, invitees: { select: { user_id: true } } },

    });

    return this.serializeCreatedClub(row, u);

  }



  async cancel(idParam: string, u: RequestUserPayload) {

    this.assertLeadership(u);

    const id = toBigId(idParam, 'clubMeetingId');

    const m = await this.prisma.club_meetings.findUnique({ where: { id } });

    if (!m) {

      throw new NotFoundException();

    }

    if (m.status === 'cancelled') {

      throw new BadRequestException('Cuộc họp đã hủy');

    }

    const now = new Date();

    const row = await this.prisma.club_meetings.update({

      where: { id },

      data: { status: 'cancelled', cancelled_at: now },

      include: { ...includeCreator, invitees: { select: { user_id: true } } },

    });

    return this.serializeCreatedClub(row, u);

  }



  async requestAbsence(

    meetingIdParam: string,

    dto: RequestClubMeetingAbsenceDto,

    u: RequestUserPayload,

  ) {

    const meetingId = toBigId(meetingIdParam, 'clubMeetingId');

    const m = await this.prisma.club_meetings.findUnique({

      where: { id: meetingId },

      include: { invitees: { select: { user_id: true } } },

    });

    if (!m) {

      throw new NotFoundException();

    }

    if (m.status === 'cancelled') {

      throw new BadRequestException('Cuộc họp đã hủy');

    }

    const now = new Date();

    if (m.end_at.getTime() < now.getTime()) {

      throw new BadRequestException('Cuộc họp đã kết thúc, không xin vắng');

    }

    if (!this.userInMandatoryAttendanceAudience(u, m)) {

      throw new ForbiddenException(

        'Bạn không thuộc đối tượng bắt buộc tham dự buổi họp này',

      );

    }

    try {

      const r = await this.prisma.club_meeting_absence_requests.create({

        data: {

          club_meeting_id: meetingId,

          user_id: u.id,

          reason: dto.reason.trim(),

          status: 'pending',

        },

      });

      return {

        id: r.id.toString(),

        status: r.status,

        createdAt: r.created_at,

      };

    } catch (e) {

      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {

        throw new ConflictException('Bạn đã gửi xin vắng cho cuộc họp này');

      }

      throw e;

    }

  }



  async listAbsenceRequests(meetingIdParam: string, u: RequestUserPayload) {

    this.assertLeadership(u);

    const meetingId = toBigId(meetingIdParam, 'clubMeetingId');

    const m = await this.prisma.club_meetings.findUnique({ where: { id: meetingId } });

    if (!m) {

      throw new NotFoundException();

    }

    const rows = await this.prisma.club_meeting_absence_requests.findMany({

      where: { club_meeting_id: meetingId },

      include: {

        users: {

          select: { email: true, members: { select: { full_name: true } } },

        },

      },

      orderBy: { created_at: 'asc' },

    });

    return rows.map((r) => ({

      id: r.id.toString(),

      userId: r.user_id.toString(),

      fullName: r.users?.members?.full_name?.trim() || null,

      email: r.users?.email,

      reason: r.reason,

      status: r.status,

      createdAt: r.created_at,

      decidedAt: r.decided_at,

    }));

  }



  async decideAbsence(

    meetingIdParam: string,

    reqIdParam: string,

    dto: DecideClubMeetingAbsenceDto,

    u: RequestUserPayload,

  ) {

    this.assertLeadership(u);

    const meetingId = toBigId(meetingIdParam, 'clubMeetingId');

    const reqId = toBigId(reqIdParam, 'absenceRequestId');

    const r = await this.prisma.club_meeting_absence_requests.findFirst({

      where: { id: reqId, club_meeting_id: meetingId },

    });

    if (!r) {

      throw new NotFoundException();

    }

    if (r.status !== 'pending') {

      throw new BadRequestException('Đơn đã được xử lý');

    }

    const now = new Date();

    await this.prisma.club_meeting_absence_requests.update({

      where: { id: reqId },

      data: {

        status: dto.status,

        decided_by: u.id,

        decided_at: now,

      },

    });

    return { ok: true, id: reqId.toString(), status: dto.status };

  }

}


